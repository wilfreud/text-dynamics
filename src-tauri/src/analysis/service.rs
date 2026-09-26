use crate::persistence::Database;
use crate::secrets::KeyringStore;

#[allow(dead_code)]
pub struct AnalysisService {
    db: Database,
    secrets: KeyringStore,
}

impl AnalysisService {
    pub fn new(db: Database, secrets: KeyringStore) -> Self {
        Self { db, secrets }
    }
}
