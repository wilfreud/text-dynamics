use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::error::AppError;
use crate::persistence::activity::{
    clear_activity_events, list_activity_events as db_list_activity,
    list_sessions as db_list_sessions, ActivityEventsFilter, ActivityEventsResponse,
    SessionSummary,
};
use crate::persistence::diagnostics::{
    clear_diagnostic_log_files, list_diagnostic_logs as db_list_logs, DiagnosticLogsFilter,
    DiagnosticLogsResponse,
};
use crate::state::AppState;

#[tauri::command]
pub fn list_activity_events(
    state: State<'_, AppState>,
    filter: ActivityEventsFilter,
) -> Result<ActivityEventsResponse, AppError> {
    db_list_activity(&state.db, filter)
}

#[tauri::command]
pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<SessionSummary>, AppError> {
    db_list_sessions(&state.db, &state.session_id)
}

#[tauri::command]
pub fn get_current_session_id(state: State<'_, AppState>) -> String {
    state.session_id.clone()
}

#[tauri::command]
pub fn list_diagnostic_logs(
    state: State<'_, AppState>,
    filter: DiagnosticLogsFilter,
) -> Result<DiagnosticLogsResponse, AppError> {
    db_list_logs(&state.log_dir, filter)
}

#[tauri::command]
pub fn open_logs_folder(app: AppHandle, state: State<'_, AppState>) -> Result<(), AppError> {
    let folder_str = state.log_dir.to_string_lossy().to_string();
    log::info!("[diagnostics] Opening logs folder: {}", folder_str);
    app.opener()
        .open_path(folder_str, None::<&str>)
        .map_err(|e| AppError::Internal(format!("Failed to open logs folder: {e}")))?;
    Ok(())
}

#[tauri::command]
pub fn clear_activity_history(state: State<'_, AppState>) -> Result<(), AppError> {
    clear_activity_events(&state.db)
}

#[tauri::command]
pub fn clear_diagnostic_logs(state: State<'_, AppState>) -> Result<(), AppError> {
    clear_diagnostic_log_files(&state.log_dir)
}
