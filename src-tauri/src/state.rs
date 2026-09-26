use crate::persistence::Database;
use crate::secrets::KeyringStore;

pub struct AppState {
    pub db: Database,
    pub secrets: KeyringStore,
}

impl AppState {
    pub fn new(db: Database, secrets: KeyringStore) -> Self {
        Self { db, secrets }
    }
}
