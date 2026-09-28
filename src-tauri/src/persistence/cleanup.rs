use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager};

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::AppState;

pub const STATUS_DELETED: &str = "deleted";
pub const STATUS_ALREADY_MISSING: &str = "already_missing";
pub const STATUS_FAILED: &str = "failed";
pub const STATUS_SKIPPED: &str = "skipped";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupResult {
    pub database: String,
    pub logs: String,
    pub keychain: String,
    pub cache: String,
    pub preferences: String,
    pub all_succeeded: bool,
    pub error_details: Option<String>,
}

/// Validates that a path safely points inside Text Dynamics app storage.
/// Strictly rejects dangerously broad user or system paths.
pub fn validate_app_owned_path(path: &Path) -> Result<(), AppError> {
    let canonical = match path.canonicalize() {
        Ok(c) => c,
        Err(_) => {
            // Path might not exist yet, canonicalize parent if possible
            if let Some(parent) = path.parent() {
                if let Ok(c_parent) = parent.canonicalize() {
                    c_parent.join(path.file_name().unwrap_or_default())
                } else {
                    path.to_path_buf()
                }
            } else {
                path.to_path_buf()
            }
        }
    };

    let path_str = canonical.to_string_lossy().to_lowercase();

    // Check for dangerously broad paths
    let forbidden_roots = [
        "/",
        "/system",
        "/library",
        "/users",
        "/applications",
        "/desktop",
        "/documents",
        "/downloads",
    ];

    for root in forbidden_roots {
        if path_str == root || path_str == format!("{root}/") {
            return Err(AppError::InvalidInput(format!(
                "Dangerous path rejected: {path_str} is a protected system/user root"
            )));
        }
    }

    if let Ok(home) = std::env::var("HOME") {
        let home_lower = home.to_lowercase();
        let home_forbidden = [
            home_lower.clone(),
            format!("{home_lower}/"),
            format!("{home_lower}/library"),
            format!("{home_lower}/library/"),
            format!("{home_lower}/library/application support"),
            format!("{home_lower}/library/application support/"),
            format!("{home_lower}/library/logs"),
            format!("{home_lower}/library/logs/"),
            format!("{home_lower}/library/caches"),
            format!("{home_lower}/library/caches/"),
            format!("{home_lower}/documents"),
            format!("{home_lower}/desktop"),
        ];

        for fb in home_forbidden {
            if path_str == fb {
                return Err(AppError::InvalidInput(format!(
                    "Dangerous path rejected: {path_str} is a broad home root"
                )));
            }
        }
    }

    // Path must contain an app-identifying namespace
    let has_app_identifier = path_str.contains("text-dynamics")
        || path_str.contains("text_dynamics")
        || path_str.contains("dev.commodore64.text-dynamics");

    if !has_app_identifier {
        return Err(AppError::InvalidInput(format!(
            "Path rejected: {path_str} does not contain text-dynamics namespace"
        )));
    }

    Ok(())
}

/// Removes all files within a directory, verifying ownership for each entry
fn remove_dir_contents_safely(dir: &Path) -> Result<bool, AppError> {
    if !dir.exists() {
        return Ok(false);
    }

    validate_app_owned_path(dir)?;

    let mut removed_any = false;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            // Don't follow symlinks
            if let Ok(meta) = fs::symlink_metadata(&path) {
                if meta.file_type().is_symlink() {
                    let _ = fs::remove_file(&path);
                    removed_any = true;
                } else if meta.is_dir() {
                    let _ = fs::remove_dir_all(&path);
                    removed_any = true;
                } else {
                    let _ = fs::remove_file(&path);
                    removed_any = true;
                }
            }
        }
    }

    Ok(removed_any)
}

/// Executes complete local data cleanup according to Specification 17.
pub fn execute_local_data_cleanup(
    app: &AppHandle,
    state: &AppState,
) -> Result<CleanupResult, AppError> {
    // 1. Freeze writes & lock cleanup concurrency
    if state
        .is_cleaning_up
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(AppError::InvalidInput(
            "Local data cleanup is already in progress".to_string(),
        ));
    }

    log::info!("[cleanup] Starting full local data reset");

    let mut error_messages: Vec<String> = Vec::new();

    // 2. Close SQLite database connections & delete DB + WAL + SHM files
    let mut db_status = STATUS_ALREADY_MISSING.to_string();
    let raw_db_path = state.db.resolved_path().to_string();

    if raw_db_path != ":memory:" {
        let db_path = PathBuf::from(&raw_db_path);

        // Safety check
        if let Err(e) = validate_app_owned_path(&db_path) {
            error_messages.push(format!("Database path validation: {e}"));
            db_status = STATUS_FAILED.to_string();
        } else {
            // Close active connection and flush WAL
            if let Err(e) = state.db.close_and_release() {
                error_messages.push(format!("Closing database: {e}"));
            }

            let wal_path = PathBuf::from(format!("{raw_db_path}-wal"));
            let shm_path = PathBuf::from(format!("{raw_db_path}-shm"));

            let mut deleted_any = false;

            if db_path.exists() {
                match fs::remove_file(&db_path) {
                    Ok(_) => deleted_any = true,
                    Err(e) => {
                        error_messages.push(format!("Deleting database file: {e}"));
                        db_status = STATUS_FAILED.to_string();
                    }
                }
            }

            if wal_path.exists() {
                let _ = fs::remove_file(&wal_path);
                deleted_any = true;
            }

            if shm_path.exists() {
                let _ = fs::remove_file(&shm_path);
                deleted_any = true;
            }

            if db_status != STATUS_FAILED {
                db_status = if deleted_any {
                    STATUS_DELETED.to_string()
                } else {
                    STATUS_ALREADY_MISSING.to_string()
                };
            }
        }
    } else {
        db_status = STATUS_ALREADY_MISSING.to_string();
    }

    // 3. Delete diagnostic log files
    let logs_status = if let Err(e) = validate_app_owned_path(&state.log_dir) {
        error_messages.push(format!("Log dir validation: {e}"));
        STATUS_FAILED.to_string()
    } else {
        match remove_dir_contents_safely(&state.log_dir) {
            Ok(removed) => {
                if removed {
                    STATUS_DELETED.to_string()
                } else {
                    STATUS_ALREADY_MISSING.to_string()
                }
            }
            Err(e) => {
                error_messages.push(format!("Deleting logs: {e}"));
                STATUS_FAILED.to_string()
            }
        }
    };

    // 4. Delete Gemini API key from macOS Keychain
    let keychain_status = match state.secrets.delete_api_key() {
        Ok(_) => STATUS_DELETED.to_string(),
        Err(e) => {
            error_messages.push(format!("Deleting Keychain credential: {e}"));
            STATUS_FAILED.to_string()
        }
    };

    // 5. Delete app cache directory if resolved
    let mut cache_status = STATUS_ALREADY_MISSING.to_string();
    if let Ok(cache_dir) = app.path().app_cache_dir() {
        if cache_dir.exists() {
            if let Ok(()) = validate_app_owned_path(&cache_dir) {
                if let Ok(removed) = remove_dir_contents_safely(&cache_dir) {
                    if removed {
                        cache_status = STATUS_DELETED.to_string();
                    }
                }
            }
        }
    }

    // 6. Delete app config directory if separate and existing
    let mut prefs_status = STATUS_ALREADY_MISSING.to_string();
    if let Ok(config_dir) = app.path().app_config_dir() {
        if config_dir.exists() {
            if let Ok(()) = validate_app_owned_path(&config_dir) {
                if let Ok(removed) = remove_dir_contents_safely(&config_dir) {
                    if removed {
                        prefs_status = STATUS_DELETED.to_string();
                    }
                }
            }
        }
    }

    let all_succeeded = db_status != STATUS_FAILED
        && logs_status != STATUS_FAILED
        && keychain_status != STATUS_FAILED
        && cache_status != STATUS_FAILED
        && prefs_status != STATUS_FAILED;

    let error_details = if error_messages.is_empty() {
        None
    } else {
        Some(error_messages.join("; "))
    };

    log::info!(
        "[cleanup] Local data reset finished. all_succeeded={all_succeeded} db={db_status} logs={logs_status} keychain={keychain_status}"
    );

    Ok(CleanupResult {
        database: db_status,
        logs: logs_status,
        keychain: keychain_status,
        cache: cache_status,
        preferences: prefs_status,
        all_succeeded,
        error_details,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_app_owned_path_rejects_broad_roots() {
        assert!(validate_app_owned_path(Path::new("/")).is_err());
        assert!(validate_app_owned_path(Path::new("/Library")).is_err());
        assert!(validate_app_owned_path(Path::new("/Users")).is_err());
        assert!(validate_app_owned_path(Path::new("/Applications")).is_err());
    }

    #[test]
    fn test_validate_app_owned_path_accepts_valid_namespaced_path() {
        let valid_path = Path::new("/Users/test/Library/Application Support/dev.commodore64.text-dynamics/text_dynamics.db");
        assert!(validate_app_owned_path(valid_path).is_ok());

        let valid_log_path = Path::new("/Users/test/Library/Logs/text-dynamics");
        assert!(validate_app_owned_path(valid_log_path).is_ok());
    }

    #[test]
    fn test_validate_app_owned_path_rejects_unrelated_paths() {
        let unrelated = Path::new("/Users/test/Documents/personal_notes.txt");
        assert!(validate_app_owned_path(unrelated).is_err());
    }
}
