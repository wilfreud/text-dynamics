use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::persistence::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentRecord {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSummary {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub char_count: usize,
    pub line_count: usize,
}

pub fn create_document(
    db: &Database,
    title: &str,
    content: &str,
) -> Result<DocumentRecord, AppError> {
    let title_trimmed = title.trim();
    let final_title = if title_trimmed.is_empty() {
        "Untitled Document"
    } else {
        title_trimmed
    };

    let id = format!("doc_{}", Uuid::new_v4().simple());
    let now = Utc::now().to_rfc3339();

    let conn = db.conn()?;
    conn.execute(
        "INSERT INTO documents (id, title, content, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, final_title, content, now, now],
    )?;

    log::info!("Created document id={} title={}", id, final_title);

    Ok(DocumentRecord {
        id,
        title: final_title.to_string(),
        content: content.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_document(db: &Database, id: &str) -> Result<DocumentRecord, AppError> {
    let conn = db.conn()?;
    let mut stmt = conn.prepare(
        "SELECT id, title, content, created_at, updated_at
         FROM documents WHERE id = ?1",
    )?;

    let record = stmt
        .query_row(params![id], |row| {
            Ok(DocumentRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .optional()?
        .ok_or_else(|| AppError::DocumentNotFound(id.to_string()))?;

    Ok(record)
}

pub fn update_document(
    db: &Database,
    id: &str,
    title: Option<&str>,
    content: Option<&str>,
) -> Result<DocumentRecord, AppError> {
    let mut doc = get_document(db, id)?;
    let now = Utc::now().to_rfc3339();

    if let Some(t) = title {
        let trimmed = t.trim();
        if !trimmed.is_empty() {
            doc.title = trimmed.to_string();
        }
    }

    if let Some(c) = content {
        doc.content = c.to_string();
    }
    doc.updated_at = now.clone();

    let conn = db.conn()?;
    let rows_affected = conn.execute(
        "UPDATE documents SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
        params![doc.title, doc.content, now, id],
    )?;

    if rows_affected == 0 {
        return Err(AppError::DocumentNotFound(id.to_string()));
    }

    log::info!("Updated document id={} title={}", id, doc.title);
    Ok(doc)
}

pub fn delete_document(db: &Database, id: &str) -> Result<(), AppError> {
    let conn = db.conn()?;
    let rows_affected = conn.execute("DELETE FROM documents WHERE id = ?1", params![id])?;

    if rows_affected == 0 {
        return Err(AppError::DocumentNotFound(id.to_string()));
    }

    log::info!("Deleted document id={}", id);
    Ok(())
}

pub fn list_documents(db: &Database) -> Result<Vec<DocumentSummary>, AppError> {
    let conn = db.conn()?;
    let mut stmt = conn.prepare(
        "SELECT id, title, content, created_at, updated_at
         FROM documents ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        let content: String = row.get(2)?;
        let char_count = content.chars().count();
        let line_count = if content.is_empty() {
            0
        } else {
            content.lines().count().max(1)
        };

        Ok(DocumentSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            char_count,
            line_count,
        })
    })?;

    let mut summaries = Vec::new();
    for row in rows {
        summaries.push(row?);
    }

    Ok(summaries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::analyses::{
        get_latest_analysis_for_document, get_overrides, save_analysis, save_overrides,
    };

    #[test]
    fn test_persistence_smoke() {
        let db = Database::in_memory().expect("in-memory db must initialize");

        // 1. Create document
        let doc = create_document(&db, "Test Poem", "Line 1\nLine 2\nLine 3")
            .expect("should create document");
        assert_eq!(doc.title, "Test Poem");
        assert_eq!(doc.content, "Line 1\nLine 2\nLine 3");

        // 2. Read document
        let fetched = get_document(&db, &doc.id).expect("should fetch document");
        assert_eq!(fetched.id, doc.id);

        // 3. Update document
        let updated = update_document(&db, &doc.id, Some("Updated Poem"), None)
            .expect("should update document");
        assert_eq!(updated.title, "Updated Poem");

        // 4. List documents
        let list = list_documents(&db).expect("should list documents");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].line_count, 3);

        // 5. Save analysis
        let analysis = save_analysis(
            &db,
            &doc.id,
            "1.0",
            "gemini-3.8-flash",
            "v1",
            r#"{"segments":[]}"#,
        )
        .expect("should save analysis");

        let fetched_analysis = get_latest_analysis_for_document(&db, &doc.id)
            .expect("should query analysis")
            .expect("analysis should exist");
        assert_eq!(fetched_analysis.id, analysis.id);

        // 6. Save overrides
        save_overrides(&db, &analysis.id, r#"{"segment_overrides":{}}"#)
            .expect("should save overrides");
        let fetched_overrides = get_overrides(&db, &analysis.id)
            .expect("should query overrides")
            .expect("overrides should exist");
        assert_eq!(
            fetched_overrides.overrides_json,
            r#"{"segment_overrides":{}}"#
        );

        // 7. Delete document (cascades to analyses and overrides)
        delete_document(&db, &doc.id).expect("should delete document");
        assert!(get_document(&db, &doc.id).is_err());
        assert!(get_latest_analysis_for_document(&db, &doc.id)
            .unwrap()
            .is_none());
    }
}
