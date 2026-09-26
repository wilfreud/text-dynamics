use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::persistence::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisRecord {
    pub id: String,
    pub document_id: String,
    pub schema_version: String,
    pub model_id: String,
    pub prompt_version: String,
    pub raw_analysis_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisOverridesRecord {
    pub analysis_id: String,
    pub overrides_json: String,
    pub updated_at: String,
}

pub fn save_analysis(
    db: &Database,
    document_id: &str,
    schema_version: &str,
    model_id: &str,
    prompt_version: &str,
    raw_analysis_json: &str,
) -> Result<AnalysisRecord, AppError> {
    let id = format!("ana_{}", Uuid::new_v4().simple());
    let now = Utc::now().to_rfc3339();

    let conn = db.conn()?;
    conn.execute(
        "INSERT INTO analyses (id, document_id, schema_version, model_id, prompt_version, raw_analysis_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            document_id,
            schema_version,
            model_id,
            prompt_version,
            raw_analysis_json,
            now
        ],
    )?;

    log::info!("Saved analysis id={} for document_id={}", id, document_id);

    Ok(AnalysisRecord {
        id,
        document_id: document_id.to_string(),
        schema_version: schema_version.to_string(),
        model_id: model_id.to_string(),
        prompt_version: prompt_version.to_string(),
        raw_analysis_json: raw_analysis_json.to_string(),
        created_at: now,
    })
}

pub fn get_latest_analysis_for_document(
    db: &Database,
    document_id: &str,
) -> Result<Option<AnalysisRecord>, AppError> {
    let conn = db.conn()?;
    let mut stmt = conn.prepare(
        "SELECT id, document_id, schema_version, model_id, prompt_version, raw_analysis_json, created_at
         FROM analyses WHERE document_id = ?1 ORDER BY created_at DESC LIMIT 1",
    )?;

    let record = stmt
        .query_row(params![document_id], |row| {
            Ok(AnalysisRecord {
                id: row.get(0)?,
                document_id: row.get(1)?,
                schema_version: row.get(2)?,
                model_id: row.get(3)?,
                prompt_version: row.get(4)?,
                raw_analysis_json: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .optional()?;

    Ok(record)
}

pub fn save_overrides(
    db: &Database,
    analysis_id: &str,
    overrides_json: &str,
) -> Result<AnalysisOverridesRecord, AppError> {
    let now = Utc::now().to_rfc3339();
    let conn = db.conn()?;

    conn.execute(
        "INSERT INTO analysis_overrides (analysis_id, overrides_json, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(analysis_id) DO UPDATE SET
             overrides_json = excluded.overrides_json,
             updated_at = excluded.updated_at",
        params![analysis_id, overrides_json, now],
    )?;

    log::info!("Saved overrides for analysis_id={}", analysis_id);

    Ok(AnalysisOverridesRecord {
        analysis_id: analysis_id.to_string(),
        overrides_json: overrides_json.to_string(),
        updated_at: now,
    })
}

pub fn get_overrides(
    db: &Database,
    analysis_id: &str,
) -> Result<Option<AnalysisOverridesRecord>, AppError> {
    let conn = db.conn()?;
    let mut stmt = conn.prepare(
        "SELECT analysis_id, overrides_json, updated_at
         FROM analysis_overrides WHERE analysis_id = ?1",
    )?;

    let record = stmt
        .query_row(params![analysis_id], |row| {
            Ok(AnalysisOverridesRecord {
                analysis_id: row.get(0)?,
                overrides_json: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .optional()?;

    Ok(record)
}
