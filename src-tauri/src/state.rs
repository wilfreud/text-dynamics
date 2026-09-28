use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::analysis::service::AnalysisService;
use crate::persistence::Database;
use crate::secrets::KeyringStore;

pub struct AppState {
    pub db: Database,
    pub secrets: KeyringStore,
    pub analysis: AnalysisService,
    pub session_id: String,
    pub log_dir: PathBuf,
    pub is_cleaning_up: Arc<AtomicBool>,
}

impl AppState {
    pub fn new(db: Database, secrets: KeyringStore, session_id: String, log_dir: PathBuf) -> Self {
        let analysis = AnalysisService::new(db.clone(), secrets.clone());
        Self {
            db,
            secrets,
            analysis,
            session_id,
            log_dir,
            is_cleaning_up: Arc::new(AtomicBool::new(false)),
        }
    }
}
