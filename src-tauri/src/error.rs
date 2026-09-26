use serde::ser::SerializeStruct;
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

    #[error("Missing API key: please configure a Gemini API key in settings")]
    MissingApiKey,

    #[error("Invalid or unauthorized API key")]
    UnauthorizedApiKey,

    #[error("Gemini rate limit exceeded: {0}")]
    RateLimitExceeded(String),

    #[error("Gemini model not found: {0}")]
    ModelNotFound(String),

    #[error("Input text is too large for the model: {0}")]
    RequestTooLarge(String),

    #[error("Network or timeout error: {0}")]
    NetworkTimeout(String),

    #[error("Gemini server error ({0}): {1}")]
    ProviderServerError(u16, String),

    #[error("Malformed response from Gemini: {0}")]
    MalformedResponse(String),

    #[error("Semantic validation failed: {0}")]
    SemanticValidation(String),

    #[error("Analysis error: {0}")]
    Analysis(String),

    #[error("Secret storage error: {0}")]
    SecretStorage(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Database(_) => "database_error",
            Self::DocumentNotFound(_) => "document_not_found",
            Self::InvalidInput(_) => "invalid_input",
            Self::MissingApiKey => "missing_api_key",
            Self::UnauthorizedApiKey => "unauthorized_api_key",
            Self::RateLimitExceeded(_) => "rate_limit_exceeded",
            Self::ModelNotFound(_) => "model_not_found",
            Self::RequestTooLarge(_) => "request_too_large",
            Self::NetworkTimeout(_) => "network_timeout",
            Self::ProviderServerError(_, _) => "provider_server_error",
            Self::MalformedResponse(_) => "malformed_response",
            Self::SemanticValidation(_) => "semantic_validation_failed",
            Self::Analysis(_) => "analysis_error",
            Self::SecretStorage(_) => "secret_storage_error",
            Self::Internal(_) => "internal_error",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}
