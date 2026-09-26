use crate::analysis::service::AnalysisService;
use crate::persistence::Database;
use crate::secrets::KeyringStore;

pub struct AppState {
    pub db: Database,
    pub secrets: KeyringStore,
    pub analysis: AnalysisService,
}

impl AppState {
    pub fn new(db: Database, secrets: KeyringStore) -> Self {
        let analysis = AnalysisService::new(db.clone(), secrets.clone());
        Self {
            db,
            secrets,
            analysis,
        }
    }
}
