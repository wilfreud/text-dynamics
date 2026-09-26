use tauri::State;

use crate::error::AppError;
use crate::persistence::analyses::{AnalysisOverridesRecord, AnalysisRecord};
use crate::state::AppState;

#[tauri::command]
pub async fn analyze_document(
    state: State<'_, AppState>,
    document_id: String,
    custom_instruction: Option<String>,
    model_override: Option<String>,
    units: Option<Vec<crate::analysis::model::SourceUnit>>,
) -> Result<AnalysisRecord, AppError> {
    state
        .analysis
        .analyze_document(
            &document_id,
            custom_instruction.as_deref(),
            model_override.as_deref(),
            units,
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
