use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::persistence::activity::{record_and_emit_activity, NewActivityEvent};
use crate::persistence::documents::{
    create_document as repo_create, delete_document as repo_delete, get_document as repo_get,
    list_documents as repo_list, update_document as repo_update, DocumentRecord, DocumentSummary,
};
use crate::state::AppState;

#[tauri::command]
pub fn create_document(
    app: AppHandle,
    state: State<'_, AppState>,
    title: String,
    content: String,
) -> Result<DocumentRecord, AppError> {
    if state
        .is_cleaning_up
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return Err(AppError::InvalidInput(
            "Operation rejected: local data cleanup is in progress".into(),
        ));
    }
    let doc = repo_create(&state.db, &title, &content)?;
    let meta = serde_json::json!({
        "title": doc.title,
        "contentChars": doc.content.len(),
    })
    .to_string();
    record_and_emit_activity(
        &app,
        &state.db,
        NewActivityEvent {
            session_id: &state.session_id,
            document_id: Some(&doc.id),
            category: "document",
            event_name: "document.created",
            level: "info",
            message: Some(&format!("Created document \"{}\"", doc.title)),
            metadata_json: Some(&meta),
            source: Some("app"),
        },
    );
    Ok(doc)
}

#[tauri::command]
pub fn get_document(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<DocumentRecord, AppError> {
    let trimmed_id = id.trim();
    if trimmed_id.is_empty() {
        return Err(AppError::InvalidInput("Document ID cannot be empty".into()));
    }
    let doc = repo_get(&state.db, trimmed_id)?;
    record_and_emit_activity(
        &app,
        &state.db,
        NewActivityEvent {
            session_id: &state.session_id,
            document_id: Some(&doc.id),
            category: "document",
            event_name: "document.opened",
            level: "info",
            message: Some(&format!("Opened document \"{}\"", doc.title)),
            metadata_json: None,
            source: Some("app"),
        },
    );
    Ok(doc)
}

#[tauri::command]
pub fn update_document(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
) -> Result<DocumentRecord, AppError> {
    if state
        .is_cleaning_up
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return Err(AppError::InvalidInput(
            "Operation rejected: local data cleanup is in progress".into(),
        ));
    }
    let trimmed_id = id.trim();
    if trimmed_id.is_empty() {
        return Err(AppError::InvalidInput("Document ID cannot be empty".into()));
    }
    let doc = repo_update(&state.db, trimmed_id, title.as_deref(), content.as_deref())?;
    let meta = serde_json::json!({
        "title": doc.title,
        "contentChars": doc.content.len(),
    })
    .to_string();
    record_and_emit_activity(
        &app,
        &state.db,
        NewActivityEvent {
            session_id: &state.session_id,
            document_id: Some(&doc.id),
            category: "document",
            event_name: "document.saved",
            level: "info",
            message: Some(&format!("Saved document \"{}\"", doc.title)),
            metadata_json: Some(&meta),
            source: Some("app"),
        },
    );
    Ok(doc)
}

#[tauri::command]
pub fn delete_document(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    if state
        .is_cleaning_up
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return Err(AppError::InvalidInput(
            "Operation rejected: local data cleanup is in progress".into(),
        ));
    }
    let trimmed_id = id.trim();
    if trimmed_id.is_empty() {
        return Err(AppError::InvalidInput("Document ID cannot be empty".into()));
    }
    repo_delete(&state.db, trimmed_id)?;
    record_and_emit_activity(
        &app,
        &state.db,
        NewActivityEvent {
            session_id: &state.session_id,
            document_id: Some(trimmed_id),
            category: "document",
            event_name: "document.deleted",
            level: "info",
            message: Some(&format!("Deleted document {}", trimmed_id)),
            metadata_json: None,
            source: Some("app"),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn list_documents(state: State<'_, AppState>) -> Result<Vec<DocumentSummary>, AppError> {
    repo_list(&state.db)
}
