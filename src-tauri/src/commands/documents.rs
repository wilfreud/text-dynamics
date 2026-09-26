use tauri::State;

use crate::error::AppError;
use crate::persistence::documents::{
    create_document as repo_create, delete_document as repo_delete, get_document as repo_get,
    list_documents as repo_list, update_document as repo_update, DocumentRecord, DocumentSummary,
};
use crate::state::AppState;

#[tauri::command]
pub fn create_document(
    state: State<'_, AppState>,
    title: String,
    content: String,
) -> Result<DocumentRecord, AppError> {
    repo_create(&state.db, &title, &content)
}

#[tauri::command]
pub fn get_document(state: State<'_, AppState>, id: String) -> Result<DocumentRecord, AppError> {
    let trimmed_id = id.trim();
    if trimmed_id.is_empty() {
        return Err(AppError::InvalidInput("Document ID cannot be empty".into()));
    }
    repo_get(&state.db, trimmed_id)
}

#[tauri::command]
pub fn update_document(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
) -> Result<DocumentRecord, AppError> {
    let trimmed_id = id.trim();
    if trimmed_id.is_empty() {
        return Err(AppError::InvalidInput("Document ID cannot be empty".into()));
    }
    repo_update(&state.db, trimmed_id, title.as_deref(), content.as_deref())
}

#[tauri::command]
pub fn delete_document(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let trimmed_id = id.trim();
    if trimmed_id.is_empty() {
        return Err(AppError::InvalidInput("Document ID cannot be empty".into()));
    }
    repo_delete(&state.db, trimmed_id)
}

#[tauri::command]
pub fn list_documents(state: State<'_, AppState>) -> Result<Vec<DocumentSummary>, AppError> {
    repo_list(&state.db)
}
