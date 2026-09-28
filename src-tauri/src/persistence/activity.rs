use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, Runtime};

use crate::error::AppError;
use crate::persistence::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEventRecord {
    pub id: String,
    pub created_at: String,
    pub session_id: String,
    pub document_id: Option<String>,
    pub category: String,
    pub event_name: String,
    pub level: String,
    pub message: Option<String>,
    pub metadata_json: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone)]
pub struct NewActivityEvent<'a> {
    pub session_id: &'a str,
    pub document_id: Option<&'a str>,
    pub category: &'a str,
    pub event_name: &'a str,
    pub level: &'a str,
    pub message: Option<&'a str>,
    pub metadata_json: Option<&'a str>,
    pub source: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub session_id: String,
    pub first_event_at: String,
    pub last_event_at: String,
    pub event_count: u32,
    pub is_current: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEventsFilter {
    pub query: Option<String>,
    pub session_id: Option<String>,
    pub document_id: Option<String>,
    pub level: Option<String>,
    pub category: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEventsResponse {
    pub events: Vec<ActivityEventRecord>,
    pub total_count: u32,
    pub has_more: bool,
}

/// Sanitizes metadata JSON strings to ensure secrets and full texts are never stored.
pub fn sanitize_metadata_json(raw_json: &str) -> String {
    if let Ok(mut val) = serde_json::from_str::<serde_json::Value>(raw_json) {
        redact_json_value(&mut val);
        return serde_json::to_string(&val).unwrap_or_else(|_| "{}".to_string());
    }
    "{}".to_string()
}

fn redact_json_value(val: &mut serde_json::Value) {
    match val {
        serde_json::Value::Object(map) => {
            for (k, v) in map.iter_mut() {
                let lower = k.to_lowercase();
                if lower.contains("api_key")
                    || lower.contains("apikey")
                    || lower.contains("token")
                    || lower.contains("secret")
                    || lower.contains("password")
                    || lower.contains("auth")
                    || lower.contains("credential")
                    || lower.contains("cookie")
                    || lower.contains("source_text")
                    || lower.contains("full_text")
                    || lower.contains("poem")
                {
                    *v = serde_json::json!("[REDACTED]");
                } else {
                    redact_json_value(v);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                redact_json_value(item);
            }
        }
        _ => {}
    }
}

pub fn record_activity_event(
    db: &Database,
    event: NewActivityEvent<'_>,
) -> Result<ActivityEventRecord, AppError> {
    let conn = db.conn()?;
    let id = format!("act_{}", uuid::Uuid::new_v4().simple());
    let created_at = Utc::now().to_rfc3339();
    let sanitized_meta = event.metadata_json.map(sanitize_metadata_json);
    let source = event.source.unwrap_or("app");

    conn.execute(
        "INSERT INTO activity_events (
            id, created_at, session_id, document_id, category, event_name, level, message, metadata_json, source
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &id,
            &created_at,
            event.session_id,
            event.document_id,
            event.category,
            event.event_name,
            event.level,
            event.message,
            sanitized_meta.as_deref(),
            source,
        ],
    )?;

    Ok(ActivityEventRecord {
        id,
        created_at,
        session_id: event.session_id.to_string(),
        document_id: event.document_id.map(|s| s.to_string()),
        category: event.category.to_string(),
        event_name: event.event_name.to_string(),
        level: event.level.to_string(),
        message: event.message.map(|s| s.to_string()),
        metadata_json: sanitized_meta,
        source: source.to_string(),
    })
}

pub fn record_and_emit_activity<R: Runtime, M: Manager<R> + Emitter<R>>(
    manager: &M,
    db: &Database,
    event: NewActivityEvent<'_>,
) -> Option<ActivityEventRecord> {
    match record_activity_event(db, event) {
        Ok(record) => {
            let _ = manager.emit("activity:created", &record);
            Some(record)
        }
        Err(e) => {
            log::warn!("[activity] Failed to record activity event: {e}");
            None
        }
    }
}

pub fn list_activity_events(
    db: &Database,
    filter: ActivityEventsFilter,
) -> Result<ActivityEventsResponse, AppError> {
    let conn = db.conn()?;
    let limit = filter.limit.unwrap_or(100).clamp(1, 500);
    let offset = filter.offset.unwrap_or(0);

    let mut where_clauses: Vec<String> = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(session_id) = filter.session_id.filter(|s| !s.trim().is_empty()) {
        where_clauses.push("session_id = ?".to_string());
        params_vec.push(Box::new(session_id));
    }

    if let Some(document_id) = filter.document_id.filter(|d| !d.trim().is_empty()) {
        where_clauses.push("document_id = ?".to_string());
        params_vec.push(Box::new(document_id));
    }

    if let Some(level) = filter.level.filter(|l| !l.trim().is_empty() && l != "all") {
        where_clauses.push("level = ?".to_string());
        params_vec.push(Box::new(level));
    }

    if let Some(category) = filter
        .category
        .filter(|c| !c.trim().is_empty() && c != "all")
    {
        where_clauses.push("category = ?".to_string());
        params_vec.push(Box::new(category));
    }

    if let Some(q) = filter.query.filter(|q| !q.trim().is_empty()) {
        let pattern = format!("%{}%", q.trim());
        where_clauses.push(
            "(event_name LIKE ? OR message LIKE ? OR category LIKE ? OR metadata_json LIKE ?)"
                .to_string(),
        );
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern));
    }

    let where_sql = if where_clauses.is_empty() {
        "".to_string()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // 1. Get total count
    let count_query = format!("SELECT COUNT(*) FROM activity_events {}", where_sql);
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let total_count: u32 =
        conn.query_row(&count_query, params_refs.as_slice(), |row| row.get(0))?;

    // 2. Fetch page (request limit + 1 to know has_more)
    let fetch_limit = limit + 1;
    let data_query = format!(
        "SELECT id, created_at, session_id, document_id, category, event_name, level, message, metadata_json, source
         FROM activity_events
         {}
         ORDER BY created_at DESC
         LIMIT {} OFFSET {}",
        where_sql, fetch_limit, offset
    );

    let mut stmt = conn.prepare(&data_query)?;
    let event_iter = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(ActivityEventRecord {
            id: row.get(0)?,
            created_at: row.get(1)?,
            session_id: row.get(2)?,
            document_id: row.get(3)?,
            category: row.get(4)?,
            event_name: row.get(5)?,
            level: row.get(6)?,
            message: row.get(7)?,
            metadata_json: row.get(8)?,
            source: row.get(9)?,
        })
    })?;

    let mut events = Vec::new();
    for event in event_iter {
        events.push(event?);
    }

    let has_more = events.len() > limit as usize;
    if has_more {
        events.truncate(limit as usize);
    }

    Ok(ActivityEventsResponse {
        events,
        total_count,
        has_more,
    })
}

pub fn list_sessions(
    db: &Database,
    current_session_id: &str,
) -> Result<Vec<SessionSummary>, AppError> {
    let conn = db.conn()?;
    let mut stmt = conn.prepare(
        "SELECT session_id, MIN(created_at), MAX(created_at), COUNT(*)
         FROM activity_events
         GROUP BY session_id
         ORDER BY MAX(created_at) DESC
         LIMIT 50",
    )?;

    let session_iter = stmt.query_map([], |row| {
        let session_id: String = row.get(0)?;
        let first_event_at: String = row.get(1)?;
        let last_event_at: String = row.get(2)?;
        let event_count: u32 = row.get(3)?;
        let is_current = session_id == current_session_id;

        Ok(SessionSummary {
            session_id,
            first_event_at,
            last_event_at,
            event_count,
            is_current,
        })
    })?;

    let mut sessions = Vec::new();
    for s in session_iter {
        sessions.push(s?);
    }

    // Ensure the current session is in the list even if it has no events yet
    if !sessions.iter().any(|s| s.session_id == current_session_id) {
        let now = Utc::now().to_rfc3339();
        sessions.insert(
            0,
            SessionSummary {
                session_id: current_session_id.to_string(),
                first_event_at: now.clone(),
                last_event_at: now,
                event_count: 0,
                is_current: true,
            },
        );
    }

    Ok(sessions)
}

/// Enforces bounded retention (e.g. 90 days or max 50,000 events)
pub fn prune_activity_events(
    db: &Database,
    max_age_days: u32,
    max_events: u32,
) -> Result<usize, AppError> {
    let conn = db.conn()?;
    let cutoff_date = Utc::now() - chrono::Duration::days(max_age_days as i64);
    let cutoff_str = cutoff_date.to_rfc3339();

    // 1. Delete events older than max_age_days
    let deleted_by_age = conn.execute(
        "DELETE FROM activity_events WHERE created_at < ?1",
        params![cutoff_str],
    )?;

    // 2. If event count exceeds max_events, keep only the latest max_events
    let count: u32 =
        conn.query_row("SELECT COUNT(*) FROM activity_events", [], |row| row.get(0))?;

    let mut deleted_by_count = 0;
    if count > max_events {
        let excess = count - max_events;
        deleted_by_count = conn.execute(
            "DELETE FROM activity_events WHERE id IN (
                SELECT id FROM activity_events ORDER BY created_at ASC LIMIT ?1
            )",
            params![excess],
        )?;
    }

    let total = deleted_by_age + deleted_by_count;
    if total > 0 {
        log::info!(
            "[activity] Pruned {} activity events (age={}, excess={})",
            total,
            deleted_by_age,
            deleted_by_count
        );
    }

    Ok(total)
}

pub fn clear_activity_events(db: &Database) -> Result<(), AppError> {
    let conn = db.conn()?;
    conn.execute("DELETE FROM activity_events", [])?;
    log::info!("[activity] Cleared all activity events");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_and_list_activity_events() {
        let db = Database::in_memory().expect("in-memory db must initialize");

        let event = record_activity_event(
            &db,
            NewActivityEvent {
                session_id: "sess_test_123",
                document_id: Some("doc_42"),
                category: "document",
                event_name: "document.created",
                level: "info",
                message: Some("Created test document"),
                metadata_json: Some(r#"{"title":"Test Doc","chars":120}"#),
                source: Some("app"),
            },
        )
        .expect("should record event");

        assert_eq!(event.session_id, "sess_test_123");
        assert_eq!(event.document_id.as_deref(), Some("doc_42"));

        let res = list_activity_events(
            &db,
            ActivityEventsFilter {
                session_id: Some("sess_test_123".to_string()),
                ..Default::default()
            },
        )
        .expect("should list events");

        assert_eq!(res.total_count, 1);
        assert_eq!(res.events[0].id, event.id);
        assert_eq!(res.events[0].event_name, "document.created");
    }

    #[test]
    fn test_metadata_redaction() {
        let raw = r#"{
            "api_key": "AIzaSySecret123",
            "token": "bearer xyz",
            "source_text": "This is a full private poem that must never be logged",
            "model": "gemini-2.5-flash",
            "durationMs": 450
        }"#;

        let sanitized = sanitize_metadata_json(raw);
        assert!(!sanitized.contains("AIzaSySecret123"));
        assert!(!sanitized.contains("bearer xyz"));
        assert!(!sanitized.contains("This is a full private poem"));
        assert!(sanitized.contains("[REDACTED]"));
        assert!(sanitized.contains("gemini-2.5-flash"));
        assert!(sanitized.contains("450"));
    }

    #[test]
    fn test_prune_activity_events() {
        let db = Database::in_memory().expect("in-memory db must initialize");

        for i in 0..10 {
            record_activity_event(
                &db,
                NewActivityEvent {
                    session_id: "sess_prune",
                    document_id: None,
                    category: "app",
                    event_name: "app.ping",
                    level: "info",
                    message: Some(&format!("Ping {i}")),
                    metadata_json: None,
                    source: None,
                },
            )
            .expect("should record event");
        }

        // Prune to max 5 events
        let pruned = prune_activity_events(&db, 90, 5).expect("prune should succeed");
        assert_eq!(pruned, 5);

        let res =
            list_activity_events(&db, ActivityEventsFilter::default()).expect("should list events");
        assert_eq!(res.total_count, 5);
    }
}
