use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::persistence::cleanup::{execute_local_data_cleanup, CleanupResult};
use crate::state::AppState;

#[tauri::command]
pub fn delete_all_local_data(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<CleanupResult, AppError> {
    execute_local_data_cleanup(&app, &state)
}

#[tauri::command]
pub fn restart_app(app: AppHandle) -> Result<(), AppError> {
    log::info!("[lifecycle] Restarting application");
    app.restart();
}

#[tauri::command]
pub fn quit_app(app: AppHandle) -> Result<(), AppError> {
    log::info!("[lifecycle] Quitting application");
    app.exit(0);
    Ok(())
}
