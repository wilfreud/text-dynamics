use serde::{Deserialize, Serialize};

/// Atomic source unit passed for analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceUnitDto {
    pub id: String,
    pub text: String,
}

/// Placeholder for Gemini GenerateContent request payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiRequestDto {
    pub contents: Vec<serde_json::Value>,
}

/// Placeholder for Gemini GenerateContent response payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiResponseDto {
    pub candidates: Vec<serde_json::Value>,
}
