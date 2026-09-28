use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::error::AppError;
use crate::persistence::analyses::{AnalysisOverridesRecord, AnalysisRecord};
use crate::state::AppState;

#[tauri::command]
pub async fn analyze_document(
    app: AppHandle,
    state: State<'_, AppState>,
    document_id: String,
    custom_instruction: Option<String>,
    model_override: Option<String>,
    units: Option<Vec<crate::analysis::model::SourceUnit>>,
) -> Result<AnalysisRecord, AppError> {
    let app_handle_retry = app.clone();
    let on_retry: crate::gemini::RetryCallback = Arc::new(move |payload| {
        let _ = app_handle_retry.emit("analysis:retry", &payload);
        for win in app_handle_retry.webview_windows().values() {
            let _ = win.emit("analysis:retry", &payload);
        }
    });

    let app_handle_attempt = app.clone();
    let on_attempt: crate::gemini::AttemptCallback = Arc::new(move |payload| {
        let _ = app_handle_attempt.emit("analysis:attempt", &payload);
        for win in app_handle_attempt.webview_windows().values() {
            let _ = win.emit("analysis:attempt", &payload);
        }
    });

    state
        .analysis
        .analyze_document(
            &document_id,
            crate::analysis::AnalyzeDocumentOptions {
                custom_instruction: custom_instruction.as_deref(),
                model_override: model_override.as_deref(),
                passed_units: units,
                on_retry: Some(on_retry),
                on_attempt: Some(on_attempt),
            },
        )
        .await
}

#[tauri::command]
pub fn get_latest_analysis(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<Option<AnalysisRecord>, AppError> {
    state.analysis.get_latest_analysis(&document_id)
}

#[tauri::command]
pub fn save_analysis_overrides(
    state: State<'_, AppState>,
    analysis_id: String,
    overrides_json: String,
) -> Result<AnalysisOverridesRecord, AppError> {
    state.analysis.save_overrides(&analysis_id, &overrides_json)
}

#[tauri::command]
pub fn get_analysis_overrides(
    state: State<'_, AppState>,
    analysis_id: String,
) -> Result<Option<AnalysisOverridesRecord>, AppError> {
    state.analysis.get_overrides(&analysis_id)
}
