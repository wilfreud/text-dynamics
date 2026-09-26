use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::State;

use crate::error::AppError;
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
    Ok(())
}

#[tauri::command]
pub fn has_api_key(state: State<'_, AppState>) -> Result<bool, AppError> {
    state.secrets.has_api_key()
}

#[tauri::command]
pub fn set_api_key(state: State<'_, AppState>, api_key: String) -> Result<(), AppError> {
    state.secrets.set_api_key(&api_key)
}

#[tauri::command]
pub fn delete_api_key(state: State<'_, AppState>) -> Result<(), AppError> {
    state.secrets.delete_api_key()
}
