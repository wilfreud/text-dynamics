use std::time::{Duration, Instant};

use reqwest::{Client, StatusCode};
use serde_json::json;

use crate::analysis::model::{CanonicalAnalysis, SourceUnit};
use crate::analysis::validation::validate_canonical_analysis;
use crate::error::AppError;
use crate::gemini::schema::analysis_response_schema;

const BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_RETRIES: u32 = 2; // Total up to 3 attempts

pub struct GeminiClient {
    client: Client,
}

impl GeminiClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(DEFAULT_TIMEOUT)
            .build()
            .unwrap_or_else(|_| Client::new());

        Self { client }
    }

    pub async fn analyze(
        &self,
        api_key: &str,
        model: &str,
        system_prompt: &str,
        source_units: &[SourceUnit],
        correlation_id: &str,
        document_id: &str,
    ) -> Result<(CanonicalAnalysis, String), AppError> {
        let trimmed_key = api_key.trim();
        if trimmed_key.is_empty() {
            return Err(AppError::MissingApiKey);
        }

        let url = format!("{}/{}:generateContent", BASE_URL, model);
        let units_json = serde_json::to_string(source_units)
            .map_err(|e| AppError::Internal(format!("Failed to serialize source units: {e}")))?;

        let user_prompt = format!(
            "Analyze the dynamic structure of the following {} text units:\n{}",
            source_units.len(),
            units_json
        );

        let request_payload = json!({
            "systemInstruction": {
                "parts": [
                    { "text": system_prompt }
                ]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        { "text": user_prompt }
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": analysis_response_schema(),
                "temperature": 0.2
            }
        });

        let total_chars: usize = source_units.iter().map(|u| u.text.len()).sum();
        let mut attempt = 0;

        loop {
            attempt += 1;
            let start_time = Instant::now();

            log::info!(
                "[req_id={}] Attempt {}/{} -> model={} doc_id={} units={} chars={}",
                correlation_id,
                attempt,
                MAX_RETRIES + 1,
                model,
                document_id,
                source_units.len(),
                total_chars
            );

            let res = self
                .client
                .post(&url)
                .header("x-goog-api-key", trimmed_key)
                .header("content-type", "application/json")
                .json(&request_payload)
                .send()
                .await;

            let duration = start_time.elapsed();

            match res {
                Ok(response) => {
                    let status = response.status();
                    log::info!(
                        "[req_id={}] Response status={} latency={}ms",
                        correlation_id,
                        status.as_u16(),
                        duration.as_millis()
                    );

                    if status.is_success() {
                        let body_text = response.text().await.map_err(|e| {
                            AppError::NetworkTimeout(format!("Failed reading response body: {e}"))
                        })?;

                        return Self::parse_and_validate(&body_text, source_units, correlation_id);
                    }

                    // Handle known error status codes
                    let error_body = response.text().await.unwrap_or_default();
                    let safe_error_snippet = Self::extract_error_message(&error_body);

                    match status {
                        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                            log::warn!(
                                "[req_id={}] Unauthorized API key: {}",
                                correlation_id,
                                safe_error_snippet
                            );
                            return Err(AppError::UnauthorizedApiKey);
                        }
                        StatusCode::NOT_FOUND => {
                            log::warn!(
                                "[req_id={}] Model not found: {}",
                                correlation_id,
                                safe_error_snippet
                            );
                            return Err(AppError::ModelNotFound(format!(
                                "Model '{}' not found: {}",
                                model, safe_error_snippet
                            )));
                        }
                        StatusCode::PAYLOAD_TOO_LARGE | StatusCode::BAD_REQUEST => {
                            if safe_error_snippet.to_lowercase().contains("token")
                                || safe_error_snippet.to_lowercase().contains("too large")
                            {
                                return Err(AppError::RequestTooLarge(safe_error_snippet));
                            }
                            return Err(AppError::Analysis(format!(
                                "Provider request rejected ({}): {}",
                                status.as_u16(),
                                safe_error_snippet
                            )));
                        }
                        StatusCode::TOO_MANY_REQUESTS => {
                            if attempt <= MAX_RETRIES {
                                let backoff = Duration::from_millis(1000 * (1 << (attempt - 1)));
                                log::warn!(
                                    "[req_id={}] Rate limit 429. Retrying in {}ms...",
                                    correlation_id,
                                    backoff.as_millis()
                                );
                                tokio::time::sleep(backoff).await;
                                continue;
                            }
                            return Err(AppError::RateLimitExceeded(safe_error_snippet));
                        }
                        _ if status.is_server_error() => {
                            if attempt <= MAX_RETRIES {
                                let backoff = Duration::from_millis(1000 * (1 << (attempt - 1)));
                                log::warn!(
                                    "[req_id={}] Server error {}. Retrying in {}ms...",
                                    correlation_id,
                                    status.as_u16(),
                                    backoff.as_millis()
                                );
                                tokio::time::sleep(backoff).await;
                                continue;
                            }
                            return Err(AppError::ProviderServerError(
                                status.as_u16(),
                                safe_error_snippet,
                            ));
                        }
                        _ => {
                            return Err(AppError::Analysis(format!(
                                "Unexpected HTTP status {}: {}",
                                status.as_u16(),
                                safe_error_snippet
                            )));
                        }
                    }
                }
                Err(err) => {
                    log::warn!(
                        "[req_id={}] Network failure on attempt {}: {err}",
                        correlation_id,
                        attempt
                    );
                    if attempt <= MAX_RETRIES {
                        let backoff = Duration::from_millis(1000 * (1 << (attempt - 1)));
                        tokio::time::sleep(backoff).await;
                        continue;
                    }
                    return Err(AppError::NetworkTimeout(err.to_string()));
                }
            }
        }
    }

    fn parse_and_validate(
        body_text: &str,
        source_units: &[SourceUnit],
        correlation_id: &str,
    ) -> Result<(CanonicalAnalysis, String), AppError> {
        let resp_json: serde_json::Value = serde_json::from_str(body_text).map_err(|e| {
            AppError::MalformedResponse(format!("Invalid response JSON envelope: {e}"))
        })?;

        // Extract candidate text: candidates[0].content.parts[0].text
        let raw_analysis_str = resp_json
            .get("candidates")
            .and_then(|c| c.get(0))
            .and_then(|cand| cand.get("content"))
            .and_then(|content| content.get("parts"))
            .and_then(|parts| parts.get(0))
            .and_then(|part| part.get("text"))
            .and_then(|t| t.as_str())
            .ok_or_else(|| {
                AppError::MalformedResponse(
                    "Response missing candidates[0].content.parts[0].text".into(),
                )
            })?;

        // Deserialize into CanonicalAnalysis
        let analysis: CanonicalAnalysis = serde_json::from_str(raw_analysis_str).map_err(|e| {
            AppError::MalformedResponse(format!(
                "Failed to deserialize structured CanonicalAnalysis: {e}"
            ))
        })?;

        // Run semantic domain validation
        validate_canonical_analysis(&analysis, source_units).map_err(|e| {
            log::warn!(
                "[req_id={}] Semantic validation failed: {e}",
                correlation_id
            );
            AppError::SemanticValidation(e.to_string())
        })?;

        log::info!(
            "[req_id={}] Successfully parsed and validated analysis: {} segments, {} movements, {} phases",
            correlation_id,
            analysis.segments.len(),
            analysis.movements.len(),
            analysis.phases.len()
        );

        Ok((analysis, raw_analysis_str.to_string()))
    }

    fn extract_error_message(error_body: &str) -> String {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(error_body) {
            if let Some(msg) = val
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
            {
                return msg.to_string();
            }
        }
        // Fallback to bounded raw snippet without leaking sensitive info
        let bounded: String = error_body.chars().take(200).collect();
        if bounded.is_empty() {
            "Unknown provider error".to_string()
        } else {
            bounded
        }
    }
}

impl Default for GeminiClient {
    fn default() -> Self {
        Self::new()
    }
}
