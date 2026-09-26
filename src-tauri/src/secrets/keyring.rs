use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

pub const KEYCHAIN_SERVICE: &str = "text-dynamics";
pub const GEMINI_API_KEY_ACCOUNT: &str = "gemini-api-key";

// Legacy identifiers preserved for transparent one-time migration
pub const LEGACY_KEYCHAIN_SERVICE: &str = "dev.commodore64.text-dynamics";
pub const LEGACY_GEMINI_KEY_NAME: &str = "gemini_api_key";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum ApiKeyStatus {
    Configured,
    Missing,
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialDiagnostics {
    pub backend: String,
    pub service: String,
    pub account: String,
    pub status: ApiKeyStatus,
}

fn current_backend_name() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macos-keychain (security-framework)"
    }
    #[cfg(target_os = "windows")]
    {
        "windows-credential-manager"
    }
    #[cfg(target_os = "linux")]
    {
        "secret-service"
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        "unsupported"
    }
}

#[derive(Clone, Default)]
pub struct KeyringStore;

impl KeyringStore {
    pub fn new() -> Self {
        Self
    }

    fn get_primary_entry(&self) -> Result<Entry, AppError> {
        Entry::new(KEYCHAIN_SERVICE, GEMINI_API_KEY_ACCOUNT)
            .map_err(|e| AppError::SecretStorage(format!("Failed to create keyring entry: {e}")))
    }

    fn get_legacy_entry(&self) -> Result<Entry, AppError> {
        Entry::new(LEGACY_KEYCHAIN_SERVICE, LEGACY_GEMINI_KEY_NAME).map_err(|e| {
            AppError::SecretStorage(format!("Failed to create legacy keyring entry: {e}"))
        })
    }

    pub fn get_api_key(&self) -> Result<Option<String>, AppError> {
        let entry = self.get_primary_entry()?;
        match entry.get_password() {
            Ok(key) => {
                let trimmed = key.trim();
                if trimmed.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(trimmed.to_string()))
                }
            }
            Err(keyring::Error::NoEntry) => {
                // Check legacy entry for seamless backward-compatible migration
                if let Ok(legacy) = self.get_legacy_entry() {
                    match legacy.get_password() {
                        Ok(legacy_key) if !legacy_key.trim().is_empty() => {
                            log::info!(
                                "[credential] Migrating legacy credential ({}/{}) to primary ({}/{})",
                                LEGACY_KEYCHAIN_SERVICE,
                                LEGACY_GEMINI_KEY_NAME,
                                KEYCHAIN_SERVICE,
                                GEMINI_API_KEY_ACCOUNT
                            );
                            let trimmed_legacy = legacy_key.trim();
                            if let Ok(primary) = self.get_primary_entry() {
                                let _ = primary.set_password(trimmed_legacy);
                            }
                            return Ok(Some(trimmed_legacy.to_string()));
                        }
                        _ => {}
                    }
                }
                Ok(None)
            }
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

        let entry = self.get_primary_entry()?;
        entry.set_password(trimmed).map_err(|e| {
            AppError::SecretStorage(format!(
                "Failed to save API key to OS credential store: {e}"
            ))
        })?;

        // Read-after-write verification (Part D): verify key was written without logging it
        let read_back = entry.get_password().map_err(|e| {
            AppError::SecretStorage(format!("Read-after-write verification failed: {e}"))
        })?;

        if read_back != trimmed {
            return Err(AppError::SecretStorage(
                "Read-after-write verification failed: stored credential mismatch".into(),
            ));
        }

        log::info!(
            "[credential] API key successfully written and verified in OS credential store (service={}, account={})",
            KEYCHAIN_SERVICE,
            GEMINI_API_KEY_ACCOUNT
        );
        Ok(())
    }

    pub fn delete_api_key(&self) -> Result<(), AppError> {
        let entry = self.get_primary_entry()?;
        match entry.delete_credential() {
            Ok(_) => {
                log::info!(
                    "[credential] API key deleted from OS credential store (service={}, account={})",
                    KEYCHAIN_SERVICE,
                    GEMINI_API_KEY_ACCOUNT
                );
            }
            Err(keyring::Error::NoEntry) => {}
            Err(e) => {
                return Err(AppError::SecretStorage(format!(
                    "Failed to delete API key: {e}"
                )));
            }
        }

        // Also clean up legacy entry if present
        if let Ok(legacy) = self.get_legacy_entry() {
            let _ = legacy.delete_credential();
        }

        Ok(())
    }

    pub fn get_api_key_status(&self) -> ApiKeyStatus {
        match self.get_primary_entry() {
            Ok(entry) => match entry.get_password() {
                Ok(key) if !key.trim().is_empty() => ApiKeyStatus::Configured,
                Ok(_) | Err(keyring::Error::NoEntry) => {
                    // Check legacy entry
                    match self.get_legacy_entry() {
                        Ok(legacy) => match legacy.get_password() {
                            Ok(k) if !k.trim().is_empty() => {
                                // Transparent migration to primary entry
                                let _ = entry.set_password(k.trim());
                                ApiKeyStatus::Configured
                            }
                            Ok(_) | Err(keyring::Error::NoEntry) => ApiKeyStatus::Missing,
                            Err(e) => ApiKeyStatus::Error {
                                message: format!("Legacy credential check failed: {e}"),
                            },
                        },
                        Err(e) => ApiKeyStatus::Error {
                            message: format!("Failed to access credential store: {e}"),
                        },
                    }
                }
                Err(e) => ApiKeyStatus::Error {
                    message: format!("Failed to access credential store: {e}"),
                },
            },
            Err(e) => ApiKeyStatus::Error {
                message: format!("Failed to initialize credential entry: {e}"),
            },
        }
    }

    pub fn has_api_key(&self) -> Result<bool, AppError> {
        match self.get_api_key_status() {
            ApiKeyStatus::Configured => Ok(true),
            ApiKeyStatus::Missing => Ok(false),
            ApiKeyStatus::Error { message } => Err(AppError::SecretStorage(message)),
        }
    }

    pub fn diagnostics(&self) -> CredentialDiagnostics {
        CredentialDiagnostics {
            backend: current_backend_name().to_string(),
            service: KEYCHAIN_SERVICE.to_string(),
            account: GEMINI_API_KEY_ACCOUNT.to_string(),
            status: self.get_api_key_status(),
        }
    }
}
