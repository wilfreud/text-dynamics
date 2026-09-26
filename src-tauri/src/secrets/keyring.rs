use keyring::Entry;

use crate::error::AppError;

const SERVICE_NAME: &str = "dev.commodore64.text-dynamics";
const GEMINI_KEY_NAME: &str = "gemini_api_key";

#[derive(Clone, Default)]
pub struct KeyringStore;

impl KeyringStore {
    pub fn new() -> Self {
        Self
    }

    fn get_entry(&self) -> Result<Entry, AppError> {
        Entry::new(SERVICE_NAME, GEMINI_KEY_NAME)
            .map_err(|e| AppError::SecretStorage(format!("Failed to create keyring entry: {e}")))
    }

    pub fn get_api_key(&self) -> Result<Option<String>, AppError> {
        let entry = self.get_entry()?;
        match entry.get_password() {
            Ok(key) => Ok(Some(key)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AppError::SecretStorage(format!(
                "Failed to retrieve API key: {e}"
            ))),
        }
    }

    pub fn set_api_key(&self, key: &str) -> Result<(), AppError> {
        let trimmed = key.trim();
        if trimmed.is_empty() {
            return Err(AppError::InvalidInput(
                "API key cannot be empty".to_string(),
            ));
        }

        let entry = self.get_entry()?;
        entry
            .set_password(trimmed)
            .map_err(|e| AppError::SecretStorage(format!("Failed to save API key: {e}")))?;

        log::info!("API key saved to OS credential store");
        Ok(())
    }

    pub fn delete_api_key(&self) -> Result<(), AppError> {
        let entry = self.get_entry()?;
        match entry.delete_credential() {
            Ok(_) => {
                log::info!("API key deleted from OS credential store");
                Ok(())
            }
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(AppError::SecretStorage(format!(
                "Failed to delete API key: {e}"
            ))),
        }
    }

    pub fn has_api_key(&self) -> Result<bool, AppError> {
        let entry = self.get_entry()?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(AppError::SecretStorage(format!(
                "Failed to check API key status: {e}"
            ))),
        }
    }
}
