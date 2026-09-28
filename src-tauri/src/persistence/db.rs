use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

const CURRENT_SCHEMA_VERSION: i32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseDiagnostics {
    pub backend: String,
    pub uri: String,
    pub resolved_path: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiagnostics {
    pub credential: crate::secrets::keyring::CredentialDiagnostics,
    pub database: DatabaseDiagnostics,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
    resolved_path: String,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self, AppError> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            resolved_path: path.to_string_lossy().to_string(),
        };
        db.init_schema()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            resolved_path: ":memory:".to_string(),
        };
        db.init_schema()?;
        Ok(db)
    }

    pub fn resolved_path(&self) -> &str {
        &self.resolved_path
    }

    pub fn diagnostics(&self) -> DatabaseDiagnostics {
        let status = match self.conn() {
            Ok(_) => "open".to_string(),
            Err(e) => format!("error: {e}"),
        };
        DatabaseDiagnostics {
            backend: "sqlite".to_string(),
            uri: if self.resolved_path == ":memory:" {
                "sqlite::memory:".to_string()
            } else {
                format!("sqlite:{}", self.resolved_path)
            },
            resolved_path: self.resolved_path.clone(),
            status,
        }
    }

    pub fn conn(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.conn
            .lock()
            .map_err(|e| AppError::Internal(format!("Database mutex lock poisoned: {e}")))
    }

    fn init_schema(&self) -> Result<(), AppError> {
        let conn = self.conn()?;

        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS schema_migrations (
                 version INTEGER PRIMARY KEY,
                 applied_at TEXT NOT NULL
             );",
        )?;

        let mut stmt = conn.prepare("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")?;
        let current_version: i32 = stmt.query_row([], |row| row.get(0))?;

        if current_version < 1 {
            log::info!("Applying SQLite migration 1: initial schema");
            conn.execute_batch(
                "BEGIN TRANSACTION;

                 CREATE TABLE IF NOT EXISTS documents (
                     id TEXT PRIMARY KEY,
                     title TEXT NOT NULL,
                     content TEXT NOT NULL,
                     created_at TEXT NOT NULL,
                     updated_at TEXT NOT NULL
                 );

                 CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);

                 CREATE TABLE IF NOT EXISTS analyses (
                     id TEXT PRIMARY KEY,
                     document_id TEXT NOT NULL,
                     schema_version TEXT NOT NULL,
                     model_id TEXT NOT NULL,
                     prompt_version TEXT NOT NULL,
                     raw_analysis_json TEXT NOT NULL,
                     created_at TEXT NOT NULL,
                     FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
                 );

                 CREATE INDEX IF NOT EXISTS idx_analyses_document_id ON analyses(document_id);

                 CREATE TABLE IF NOT EXISTS analysis_overrides (
                     analysis_id TEXT PRIMARY KEY,
                     overrides_json TEXT NOT NULL,
                     updated_at TEXT NOT NULL,
                     FOREIGN KEY(analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
                 );

                 CREATE TABLE IF NOT EXISTS settings (
                     key TEXT PRIMARY KEY,
                     value TEXT NOT NULL,
                     updated_at TEXT NOT NULL
                 );

                 INSERT INTO schema_migrations (version, applied_at)
                 VALUES (1, datetime('now'));

                 COMMIT;",
            )?;
        }

        if current_version < 2 {
            log::info!("Applying SQLite migration 2: activity_events schema");
            conn.execute_batch(
                "BEGIN TRANSACTION;

                 CREATE TABLE IF NOT EXISTS activity_events (
                     id TEXT PRIMARY KEY,
                     created_at TEXT NOT NULL,
                     session_id TEXT NOT NULL,
                     document_id TEXT,
                     category TEXT NOT NULL,
                     event_name TEXT NOT NULL,
                     level TEXT NOT NULL DEFAULT 'info',
                     message TEXT,
                     metadata_json TEXT,
                     source TEXT NOT NULL DEFAULT 'app'
                 );

                 CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_events(created_at DESC);
                 CREATE INDEX IF NOT EXISTS idx_activity_session ON activity_events(session_id);
                 CREATE INDEX IF NOT EXISTS idx_activity_document ON activity_events(document_id);
                 CREATE INDEX IF NOT EXISTS idx_activity_level ON activity_events(level);
                 CREATE INDEX IF NOT EXISTS idx_activity_event ON activity_events(event_name);

                 INSERT INTO schema_migrations (version, applied_at)
                 VALUES (2, datetime('now'));

                 COMMIT;",
            )?;
        }

        log::debug!(
            "Database initialized. Current schema version: {}",
            CURRENT_SCHEMA_VERSION
        );
        Ok(())
    }
}
