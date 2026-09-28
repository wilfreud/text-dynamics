use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::error::AppError;
use crate::persistence::activity::{record_and_emit_activity, NewActivityEvent};
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
    let start_meta = serde_json::json!({
        "modelOverride": model_override.as_deref(),
        "hasCustomInstruction": custom_instruction.is_some(),
        "unitsCount": units.as_ref().map(|u| u.len()),
    })
    .to_string();

    record_and_emit_activity(
        &app,
        &state.db,
        NewActivityEvent {
            session_id: &state.session_id,
            document_id: Some(&document_id),
            category: "analysis",
            event_name: "analysis.started",
            level: "info",
            message: Some("Analysis started"),
            metadata_json: Some(&start_meta),
            source: Some("app"),
        },
    );

    let app_handle_retry = app.clone();
    let db_retry = state.db.clone();
    let session_id_retry = state.session_id.clone();
    let doc_id_retry = document_id.clone();
    let on_retry: crate::gemini::RetryCallback = Arc::new(move |payload| {
        let _ = app_handle_retry.emit("analysis:retry", &payload);
        for win in app_handle_retry.webview_windows().values() {
            let _ = win.emit("analysis:retry", &payload);
        }

        let retry_meta = serde_json::json!({
            "attempt": payload.attempt,
            "maxRetries": payload.max_retries,
            "delayMs": payload.delay_ms,
            "message": payload.message,
            "statusCode": payload.status_code,
        })
        .to_string();
        record_and_emit_activity(
            &app_handle_retry,
            &db_retry,
            NewActivityEvent {
                session_id: &session_id_retry,
                document_id: Some(&doc_id_retry),
                category: "analysis",
                event_name: "analysis.validation_retry",
                level: "warn",
                message: Some(&format!(
                    "Analysis attempt {} failed; retrying in {}ms: {}",
                    payload.attempt, payload.delay_ms, payload.message
                )),
                metadata_json: Some(&retry_meta),
                source: Some("app"),
            },
        );
    });

    let app_handle_attempt = app.clone();
    let on_attempt: crate::gemini::AttemptCallback = Arc::new(move |payload| {
        let _ = app_handle_attempt.emit("analysis:attempt", &payload);
        for win in app_handle_attempt.webview_windows().values() {
            let _ = win.emit("analysis:attempt", &payload);
        }
    });

    let start_time = std::time::Instant::now();
    let result = state
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
        .await;

    let duration_ms = start_time.elapsed().as_millis() as u64;

    match result {
        Ok(record) => {
            let meta = serde_json::json!({
                "model": record.model_id,
                "analysisId": record.id,
                "durationMs": duration_ms,
            })
            .to_string();
            record_and_emit_activity(
                &app,
                &state.db,
                NewActivityEvent {
                    session_id: &state.session_id,
                    document_id: Some(&document_id),
                    category: "analysis",
                    event_name: "analysis.completed",
                    level: "info",
                    message: Some(&format!(
                        "Analysis completed in {}ms ({})",
                        duration_ms, record.model_id
                    )),
                    metadata_json: Some(&meta),
                    source: Some("app"),
                },
            );
            Ok(record)
        }
        Err(err) => {
            let meta = serde_json::json!({
                "error": err.to_string(),
                "durationMs": duration_ms,
            })
            .to_string();
            record_and_emit_activity(
                &app,
                &state.db,
                NewActivityEvent {
                    session_id: &state.session_id,
                    document_id: Some(&document_id),
                    category: "analysis",
                    event_name: "analysis.failed",
                    level: "error",
                    message: Some(&format!("Analysis failed: {err}")),
                    metadata_json: Some(&meta),
                    source: Some("app"),
                },
            );
            Err(err)
        }
    }
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
    app: AppHandle,
    state: State<'_, AppState>,
    analysis_id: String,
    overrides_json: String,
) -> Result<AnalysisOverridesRecord, AppError> {
    let rec = state
        .analysis
        .save_overrides(&analysis_id, &overrides_json)?;
    let meta = serde_json::json!({ "analysisId": analysis_id }).to_string();
    record_and_emit_activity(
        &app,
        &state.db,
        NewActivityEvent {
            session_id: &state.session_id,
            document_id: None,
            category: "analysis",
            event_name: "metric.override_changed",
            level: "info",
            message: Some("Analysis metric overrides updated"),
            metadata_json: Some(&meta),
            source: Some("app"),
        },
    );
    Ok(rec)
}

#[tauri::command]
pub fn get_analysis_overrides(
    state: State<'_, AppState>,
    analysis_id: String,
) -> Result<Option<AnalysisOverridesRecord>, AppError> {
    state.analysis.get_overrides(&analysis_id)
}
