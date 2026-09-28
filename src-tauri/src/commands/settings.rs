use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::State;

use crate::error::AppError;
use crate::persistence::db::RuntimeDiagnostics;
use crate::secrets::keyring::ApiKeyStatus;
use crate::state::AppState;

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, AppError> {
    let conn = state.db.conn()?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let val: Option<String> = stmt.query_row(params![key], |row| row.get(0)).optional()?;
    Ok(val)
}

#[tauri::command]
pub fn save_setting(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    let trimmed_key = key.trim();
    if trimmed_key.is_empty() {
        return Err(AppError::InvalidInput("Setting key cannot be empty".into()));
    }

    let now = Utc::now().to_rfc3339();
    let conn = state.db.conn()?;
    conn.execute(
        "INSERT INTO settings (key, value, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at",
        params![trimmed_key, value, now],
    )?;

    log::info!("Saved non-secret setting key={}", trimmed_key);

    if trimmed_key == "gemini_model" {
        let meta = serde_json::json!({ "model": value }).to_string();
        crate::persistence::activity::record_and_emit_activity(
            &app,
            &state.db,
            crate::persistence::activity::NewActivityEvent {
                session_id: &state.session_id,
                document_id: None,
                category: "settings",
                event_name: "settings.model_changed",
                level: "info",
                message: Some(&format!("Gemini model changed to {}", value)),
                metadata_json: Some(&meta),
                source: Some("app"),
            },
        );
    }

    Ok(())
}

#[tauri::command]
pub fn get_api_key_status(state: State<'_, AppState>) -> ApiKeyStatus {
    state.secrets.get_api_key_status()
}

#[tauri::command]
pub fn has_api_key(state: State<'_, AppState>) -> Result<bool, AppError> {
    state.secrets.has_api_key()
}

#[tauri::command]
pub fn set_api_key(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    api_key: String,
) -> Result<(), AppError> {
    state.secrets.set_api_key(&api_key)?;
    crate::persistence::activity::record_and_emit_activity(
        &app,
        &state.db,
        crate::persistence::activity::NewActivityEvent {
            session_id: &state.session_id,
            document_id: None,
            category: "security",
            event_name: "keychain.key_saved",
            level: "info",
            message: Some("Gemini API key saved to keychain"),
            metadata_json: None,
            source: Some("app"),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn delete_api_key(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), AppError> {
    state.secrets.delete_api_key()?;
    crate::persistence::activity::record_and_emit_activity(
        &app,
        &state.db,
        crate::persistence::activity::NewActivityEvent {
            session_id: &state.session_id,
            document_id: None,
            category: "security",
            event_name: "keychain.key_deleted",
            level: "info",
            message: Some("Gemini API key deleted from keychain"),
            metadata_json: None,
            source: Some("app"),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn get_runtime_diagnostics(state: State<'_, AppState>) -> RuntimeDiagnostics {
    RuntimeDiagnostics {
        credential: state.secrets.diagnostics(),
        database: state.db.diagnostics(),
    }
}

#[tauri::command]
pub async fn list_gemini_models(
    state: State<'_, AppState>,
) -> Result<Vec<crate::gemini::GeminiModelOption>, AppError> {
    state.analysis.list_models().await
}
