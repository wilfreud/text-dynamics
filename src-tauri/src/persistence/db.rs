use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};

use rusqlite::Connection;

use crate::error::AppError;

const CURRENT_SCHEMA_VERSION: i32 = 1;

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self, AppError> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_schema()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_schema()?;
        Ok(db)
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

        log::debug!(
            "Database initialized. Current schema version: {}",
            CURRENT_SCHEMA_VERSION
        );
        Ok(())
    }
}
