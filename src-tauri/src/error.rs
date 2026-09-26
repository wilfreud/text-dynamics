use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Document not found: {0}")]
    DocumentNotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Analysis error: {0}")]
    Analysis(String),

    #[error("Secret storage error: {0}")]
    SecretStorage(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
