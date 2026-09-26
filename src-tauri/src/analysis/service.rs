use uuid::Uuid;

use crate::analysis::prompt::{build_system_prompt, PROMPT_VERSION};
use crate::analysis::unitize::unitize_text;
use crate::error::AppError;
use crate::gemini::GeminiClient;
use crate::persistence::analyses::{
    get_latest_analysis_for_document, get_overrides, save_analysis, save_overrides,
    AnalysisOverridesRecord, AnalysisRecord,
};
use crate::persistence::documents::get_document;
use crate::persistence::Database;
use crate::secrets::KeyringStore;

const DEFAULT_MODEL: &str = "gemini-3.8-flash";

pub struct AnalysisService {
    db: Database,
    secrets: KeyringStore,
    gemini_client: GeminiClient,
}

impl AnalysisService {
    pub fn new(db: Database, secrets: KeyringStore) -> Self {
        Self {
            db,
            secrets,
            gemini_client: GeminiClient::new(),
        }
    }

    pub async fn analyze_document(
        &self,
        document_id: &str,
        custom_instruction: Option<&str>,
        model_override: Option<&str>,
        passed_units: Option<Vec<crate::analysis::model::SourceUnit>>,
    ) -> Result<AnalysisRecord, AppError> {
        let trimmed_doc_id = document_id.trim();
        if trimmed_doc_id.is_empty() {
            return Err(AppError::InvalidInput("Document ID cannot be empty".into()));
        }

        // 1. Fetch document
        let doc = get_document(&self.db, trimmed_doc_id)?;
        if doc.content.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Document content is empty; cannot analyze".into(),
            ));
        }

        // 2. Fetch API key from OS keyring
        let api_key = self.secrets.get_api_key()?.ok_or(AppError::MissingApiKey)?;

        // 3. Resolve model setting
        let model = if let Some(m) = model_override {
            m.to_string()
        } else {
            let conn = self.db.conn()?;
            let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'model_id'")?;
            stmt.query_row([], |row| row.get(0))
                .unwrap_or_else(|_| DEFAULT_MODEL.to_string())
        };

        // 4. Deterministically unitize source text (use frontend-provided atomic units if available)
        let units = if let Some(provided) = passed_units.filter(|u| !u.is_empty()) {
            provided
        } else {
            unitize_text(&doc.content)
        };

        if units.is_empty() {
            return Err(AppError::InvalidInput(
                "No readable units extracted from text".into(),
            ));
        }

        // 5. Build prompt with versioning
        let system_prompt = build_system_prompt(custom_instruction);
        let correlation_id = format!("req_{}", Uuid::new_v4().simple());

        // 6. Call Gemini API over HTTPS
        let (analysis, raw_analysis_json) = self
            .gemini_client
            .analyze(
                &api_key,
                &model,
                &system_prompt,
                &units,
                &correlation_id,
                trimmed_doc_id,
            )
            .await?;

        // 7. Persist validated analysis
        let record = save_analysis(
            &self.db,
            trimmed_doc_id,
            &analysis.schema_version,
            &model,
            PROMPT_VERSION,
            &raw_analysis_json,
        )?;

        log::info!(
            "[req_id={}] Analysis persisted successfully with id={} for doc_id={}",
            correlation_id,
            record.id,
            trimmed_doc_id
        );

        Ok(record)
    }

    pub fn get_latest_analysis(
        &self,
        document_id: &str,
    ) -> Result<Option<AnalysisRecord>, AppError> {
        get_latest_analysis_for_document(&self.db, document_id)
    }

    pub fn save_overrides(
        &self,
        analysis_id: &str,
        overrides_json: &str,
    ) -> Result<AnalysisOverridesRecord, AppError> {
        save_overrides(&self.db, analysis_id, overrides_json)
    }

    pub fn get_overrides(
        &self,
        analysis_id: &str,
    ) -> Result<Option<AnalysisOverridesRecord>, AppError> {
        get_overrides(&self.db, analysis_id)
    }

    pub async fn list_models(&self) -> Result<Vec<crate::gemini::GeminiModelOption>, AppError> {
        let api_key = self.secrets.get_api_key()?.ok_or(AppError::MissingApiKey)?;
        let correlation_id = format!("req_{}", Uuid::new_v4().simple());
        self.gemini_client
            .list_models(&api_key, &correlation_id)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::documents::create_document;

    #[test]
    #[ignore = "requires interactive OS Keychain access"]
    fn test_analyze_document_fails_cleanly_without_api_key() {
        tauri::async_runtime::block_on(async {
            let db = Database::in_memory().expect("in-memory db must initialize");
            let secrets = KeyringStore::new();

            // If a developer key is present in OS keychain, don't delete real developer credentials in unit tests
            if secrets.get_api_key().ok().flatten().is_some() {
                return;
            }

            let doc = create_document(&db, "Test Poem", "Line 1\nLine 2\n")
                .expect("document creation should succeed");

            let service = AnalysisService::new(db, secrets);
            let result = service.analyze_document(&doc.id, None, None, None).await;

            match result {
                Err(AppError::MissingApiKey) => {
                    // Expected: clean failure on missing API key
                }
                other => panic!("Expected AppError::MissingApiKey, got: {:?}", other),
            }
        });
    }

    #[test]
    fn test_analyze_document_fails_on_empty_content() {
        tauri::async_runtime::block_on(async {
            let db = Database::in_memory().expect("in-memory db must initialize");
            let secrets = KeyringStore::new();

            let doc = create_document(&db, "Empty Poem", "   \n\n  ")
                .expect("document creation should succeed");

            let service = AnalysisService::new(db, secrets);
            let result = service.analyze_document(&doc.id, None, None, None).await;

            match result {
                Err(AppError::InvalidInput(_)) => {
                    // Expected
                }
                other => panic!("Expected AppError::InvalidInput, got: {:?}", other),
            }
        });
    }
}
