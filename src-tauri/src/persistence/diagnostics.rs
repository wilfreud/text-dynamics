use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticLogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: String,
    pub message: String,
    pub session_id: Option<String>,
    pub document_id: Option<String>,
    pub component: Option<String>,
    pub raw_line: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticLogsFilter {
    pub query: Option<String>,
    pub level: Option<String>,
    pub session_id: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticLogsResponse {
    pub logs: Vec<DiagnosticLogEntry>,
    pub total_count: u32,
    pub has_more: bool,
    pub log_folder_path: String,
}

/// Parses a line from tauri-plugin-log into a structured DiagnosticLogEntry.
/// Handles standard bracket formats such as:
/// `[2026-09-28 11:42:14.812] [INFO] [session=sess_x] [doc=doc_42] [analysis] Message here...`
/// or `[2026-09-28 11:42:14] [INFO] Message`
pub fn parse_log_line(line: &str, line_idx: usize) -> DiagnosticLogEntry {
    let trimmed = line.trim();
    let mut parts: Vec<&str> = Vec::new();
    let mut rest = trimmed;

    // Extract leading bracket tokens [token]
    while rest.starts_with('[') {
        if let Some(close_idx) = rest.find(']') {
            let token = &rest[1..close_idx];
            parts.push(token);
            rest = rest[close_idx + 1..].trim_start();
        } else {
            break;
        }
    }

    let mut timestamp = String::new();
    let mut level = "INFO".to_string();
    let mut session_id = None;
    let mut document_id = None;
    let mut component = None;

    for part in parts {
        let p = part.trim();
        if let Some(stripped) = p.strip_prefix("session=") {
            session_id = Some(stripped.to_string());
        } else if let Some(stripped) = p.strip_prefix("doc=") {
            document_id = Some(stripped.to_string());
        } else if let Some(stripped) = p.strip_prefix("doc_id=") {
            document_id = Some(stripped.to_string());
        } else if p.eq_ignore_ascii_case("ERROR")
            || p.eq_ignore_ascii_case("WARN")
            || p.eq_ignore_ascii_case("WARNING")
            || p.eq_ignore_ascii_case("INFO")
            || p.eq_ignore_ascii_case("DEBUG")
            || p.eq_ignore_ascii_case("TRACE")
        {
            level = p.to_uppercase();
        } else if (p.contains('-') && p.contains(':')) || p.contains('T') {
            timestamp = p.to_string();
        } else if component.is_none() {
            component = Some(p.to_string());
        }
    }

    // If session or document is present inside message e.g. [session=...] or req_id=...
    if session_id.is_none() {
        if let Some(s_idx) = rest.find("session=") {
            let after = &rest[s_idx + 8..];
            let s_val: String = after
                .chars()
                .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect();
            if !s_val.is_empty() {
                session_id = Some(s_val);
            }
        }
    }

    if document_id.is_none() {
        if let Some(d_idx) = rest.find("doc_id=") {
            let after = &rest[d_idx + 7..];
            let d_val: String = after
                .chars()
                .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect();
            if !d_val.is_empty() {
                document_id = Some(d_val);
            }
        }
    }

    let msg = if !rest.is_empty() {
        rest.to_string()
    } else {
        trimmed.to_string()
    };

    DiagnosticLogEntry {
        id: format!("log_{}", line_idx),
        timestamp,
        level,
        message: msg,
        session_id,
        document_id,
        component,
        raw_line: trimmed.to_string(),
    }
}

pub fn list_diagnostic_logs(
    log_dir: &Path,
    filter: DiagnosticLogsFilter,
) -> Result<DiagnosticLogsResponse, AppError> {
    let limit = filter.limit.unwrap_or(100).clamp(1, 500) as usize;
    let offset = filter.offset.unwrap_or(0) as usize;

    let log_folder_path = log_dir.to_string_lossy().to_string();
    if !log_dir.exists() {
        return Ok(DiagnosticLogsResponse {
            logs: Vec::new(),
            total_count: 0,
            has_more: false,
            log_folder_path,
        });
    }

    // Collect all .log files and sort newest first
    let mut files: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "log") {
                files.push(path);
            }
        }
    }

    // Sort files by modified time descending (newest file first)
    files.sort_by(|a, b| {
        let meta_a = fs::metadata(a)
            .and_then(|m| m.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        let meta_b = fs::metadata(b)
            .and_then(|m| m.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        meta_b.cmp(&meta_a)
    });

    let query_lower = filter
        .query
        .as_ref()
        .map(|q| q.trim().to_lowercase())
        .filter(|q| !q.is_empty());
    let level_filter = filter
        .level
        .as_ref()
        .map(|l| l.trim().to_uppercase())
        .filter(|l| !l.is_empty() && l != "ALL");
    let session_filter = filter
        .session_id
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && *s != "all");

    let mut all_entries: Vec<DiagnosticLogEntry> = Vec::new();
    let mut global_idx = 0;

    for file_path in files {
        if let Ok(file) = File::open(&file_path) {
            let reader = BufReader::new(file);
            let mut file_lines = Vec::new();

            for line in reader.lines().map_while(Result::ok) {
                if !line.trim().is_empty() {
                    file_lines.push(line);
                }
            }

            // Iterate newest lines first (from end of file to beginning)
            for line in file_lines.into_iter().rev() {
                global_idx += 1;
                let entry = parse_log_line(&line, global_idx);

                // Apply level filter
                if let Some(ref req_level) = level_filter {
                    if !entry.level.eq_ignore_ascii_case(req_level) {
                        continue;
                    }
                }

                // Apply session filter
                if let Some(ref req_sess) = session_filter {
                    if let Some(ref sess) = entry.session_id {
                        if sess != req_sess {
                            continue;
                        }
                    } else if !entry.raw_line.contains(*req_sess) {
                        continue;
                    }
                }

                // Apply query search filter
                if let Some(ref q) = query_lower {
                    let in_msg = entry.message.to_lowercase().contains(q);
                    let in_raw = entry.raw_line.to_lowercase().contains(q);
                    let in_comp = entry
                        .component
                        .as_ref()
                        .is_some_and(|c| c.to_lowercase().contains(q));
                    if !in_msg && !in_raw && !in_comp {
                        continue;
                    }
                }

                all_entries.push(entry);
            }
        }
    }

    let total_count = all_entries.len() as u32;
    let paginated: Vec<DiagnosticLogEntry> =
        all_entries.into_iter().skip(offset).take(limit).collect();

    let has_more = offset + paginated.len() < total_count as usize;

    Ok(DiagnosticLogsResponse {
        logs: paginated,
        total_count,
        has_more,
        log_folder_path,
    })
}

/// Prunes old diagnostic log files (keeps max_files and prunes files older than max_age_days)
pub fn prune_log_files(
    log_dir: &Path,
    max_files: usize,
    max_age_days: u64,
) -> Result<usize, AppError> {
    if !log_dir.exists() {
        return Ok(0);
    }

    let mut files: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "log") {
                files.push(path);
            }
        }
    }

    // Sort by modified time descending (newest first)
    files.sort_by(|a, b| {
        let meta_a = fs::metadata(a)
            .and_then(|m| m.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        let meta_b = fs::metadata(b)
            .and_then(|m| m.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        meta_b.cmp(&meta_a)
    });

    let now = SystemTime::now();
    let max_age_duration = Duration::from_secs(max_age_days * 86400);
    let mut deleted = 0;

    for (idx, path) in files.iter().enumerate() {
        let is_excess = idx >= max_files;
        let is_stale = fs::metadata(path)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|m| now.duration_since(m).ok())
            .is_some_and(|age| age > max_age_duration);

        if (is_excess || is_stale) && fs::remove_file(path).is_ok() {
            deleted += 1;
        }
    }

    if deleted > 0 {
        log::info!("[diagnostics] Pruned {} old diagnostic log files", deleted);
    }

    Ok(deleted)
}

/// Clears all diagnostic log files
pub fn clear_diagnostic_log_files(log_dir: &Path) -> Result<(), AppError> {
    if !log_dir.exists() {
        return Ok(());
    }

    if let Ok(entries) = fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "log") {
                let _ = fs::remove_file(&path);
            }
        }
    }

    log::info!("[diagnostics] Cleared all diagnostic log files");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_log_line_standard() {
        let raw = "[2026-09-28T11:42:14.812Z] [WARN] [session=sess_abc] [doc=doc_123] [analysis] Structured output retry";
        let parsed = parse_log_line(raw, 1);

        assert_eq!(parsed.level, "WARN");
        assert_eq!(parsed.session_id.as_deref(), Some("sess_abc"));
        assert_eq!(parsed.document_id.as_deref(), Some("doc_123"));
        assert_eq!(parsed.component.as_deref(), Some("analysis"));
        assert_eq!(parsed.message, "Structured output retry");
    }

    #[test]
    fn test_parse_log_line_plain() {
        let raw = "Simple diagnostic error occurred during bootstrap";
        let parsed = parse_log_line(raw, 2);

        assert_eq!(parsed.level, "INFO");
        assert_eq!(
            parsed.message,
            "Simple diagnostic error occurred during bootstrap"
        );
    }
}
