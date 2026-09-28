use std::time::{Duration, Instant};

use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::analysis::model::{CanonicalAnalysis, SourceUnit};
use crate::analysis::validation::validate_canonical_analysis;
use crate::error::AppError;
use crate::gemini::catalog::{
    classify_billing, is_text_analysis_candidate, sort_model_catalog, BillingAvailability,
    GeminiModelOption, RawGeminiModelDto, RawListModelsResponse,
};
use crate::gemini::schema::analysis_response_schema;

const BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_RETRIES: u32 = 4; // Up to 4 retries (5 attempts total)

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRetryPayload {
    pub attempt: u32,
    pub max_retries: u32,
    pub delay_ms: u64,
    pub status_code: Option<u16>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisAttemptPayload {
    pub attempt: u32,
    pub max_attempts: u32,
}

pub type RetryCallback = std::sync::Arc<dyn Fn(AnalysisRetryPayload) + Send + Sync>;
pub type AttemptCallback = std::sync::Arc<dyn Fn(AnalysisAttemptPayload) + Send + Sync>;

#[derive(Clone)]
pub struct AnalysisRequest<'a> {
    pub api_key: &'a str,
    pub model: &'a str,
    pub system_prompt: &'a str,
    pub source_units: &'a [SourceUnit],
    pub correlation_id: &'a str,
    pub document_id: &'a str,
    pub on_retry: Option<RetryCallback>,
    pub on_attempt: Option<AttemptCallback>,
}

pub struct GeminiClient {
    client: Client,
}

fn compute_retry_backoff(attempt: u32, headers: Option<&reqwest::header::HeaderMap>) -> Duration {
    // Check Retry-After header if present
    if let Some(headers) = headers {
        if let Some(val) = headers.get(reqwest::header::RETRY_AFTER) {
            if let Ok(s) = val.to_str() {
                if let Ok(secs) = s.trim().parse::<u64>() {
                    // Bound to a safe range [1s, 15s]
                    let clamped = secs.clamp(1, 15);
                    return Duration::from_secs(clamped);
                }
            }
        }
    }

    // Progressive backoff schedule: 2s (retry 1), 4s (retry 2), 7s (retry 3), 10s (retry 4)
    match attempt {
        1 => Duration::from_millis(2000),
        2 => Duration::from_millis(4000),
        3 => Duration::from_millis(7000),
        _ => Duration::from_millis(10000),
    }
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
        req: AnalysisRequest<'_>,
    ) -> Result<(CanonicalAnalysis, String), AppError> {
        let trimmed_key = req.api_key.trim();
        if trimmed_key.is_empty() {
            return Err(AppError::MissingApiKey);
        }

        let url = format!("{}/{}:generateContent", BASE_URL, req.model);
        let units_json = serde_json::to_string(req.source_units)
            .map_err(|e| AppError::Internal(format!("Failed to serialize source units: {e}")))?;

        let user_prompt = format!(
            "Analyze the dynamic structure of the following {} text units:\n{}",
            req.source_units.len(),
            units_json
        );

        let request_payload = json!({
            "systemInstruction": {
                "parts": [
                    { "text": req.system_prompt }
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

        let total_chars: usize = req.source_units.iter().map(|u| u.text.len()).sum();
        let mut attempt = 0;

        loop {
            attempt += 1;
            let start_time = Instant::now();

            if let Some(ref cb) = req.on_attempt {
                cb(AnalysisAttemptPayload {
                    attempt,
                    max_attempts: MAX_RETRIES + 1,
                });
            }

            log::info!(
                "[req_id={}] Attempt {}/{} -> model={} doc_id={} units={} chars={}",
                req.correlation_id,
                attempt,
                MAX_RETRIES + 1,
                req.model,
                req.document_id,
                req.source_units.len(),
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
                    let response_headers = response.headers().clone();
                    log::info!(
                        "[req_id={}] Response status={} latency={}ms",
                        req.correlation_id,
                        status.as_u16(),
                        duration.as_millis()
                    );

                    if status.is_success() {
                        let body_text = response.text().await.map_err(|e| {
                            AppError::NetworkTimeout(format!("Failed reading response body: {e}"))
                        })?;

                        return Self::parse_and_validate(
                            &body_text,
                            req.source_units,
                            req.correlation_id,
                        );
                    }

                    // Handle known error status codes
                    let error_body = response.text().await.unwrap_or_default();
                    let safe_error_snippet = Self::extract_error_message(&error_body);

                    match status {
                        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                            log::warn!(
                                "[req_id={}] Unauthorized API key: {}",
                                req.correlation_id,
                                safe_error_snippet
                            );
                            return Err(AppError::UnauthorizedApiKey);
                        }
                        StatusCode::NOT_FOUND => {
                            log::warn!(
                                "[req_id={}] Model not found: {}",
                                req.correlation_id,
                                safe_error_snippet
                            );
                            return Err(AppError::ModelNotFound(format!(
                                "Model '{}' not found: {}",
                                req.model, safe_error_snippet
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
                                let backoff =
                                    compute_retry_backoff(attempt, Some(&response_headers));
                                let retry_msg =
                                    "Gemini rate limit reached (429). Retrying...".to_string();
                                log::warn!(
                                    "[req_id={}] Rate limit 429. Retry {}/{} in {}ms...",
                                    req.correlation_id,
                                    attempt,
                                    MAX_RETRIES,
                                    backoff.as_millis()
                                );
                                if let Some(ref cb) = req.on_retry {
                                    cb(AnalysisRetryPayload {
                                        attempt,
                                        max_retries: MAX_RETRIES,
                                        delay_ms: backoff.as_millis() as u64,
                                        status_code: Some(429),
                                        message: retry_msg,
                                    });
                                }
                                tokio::time::sleep(backoff).await;
                                continue;
                            }
                            return Err(AppError::RateLimitExceeded(safe_error_snippet));
                        }
                        _ if status.is_server_error() => {
                            if attempt <= MAX_RETRIES {
                                let backoff =
                                    compute_retry_backoff(attempt, Some(&response_headers));
                                let retry_msg = if status == StatusCode::SERVICE_UNAVAILABLE {
                                    "Gemini server is experiencing high demand (503). Retrying..."
                                        .to_string()
                                } else {
                                    format!(
                                        "Gemini server error ({}). Retrying...",
                                        status.as_u16()
                                    )
                                };
                                log::warn!(
                                    "[req_id={}] Server error {}. Retry {}/{} in {}ms...",
                                    req.correlation_id,
                                    status.as_u16(),
                                    attempt,
                                    MAX_RETRIES,
                                    backoff.as_millis()
                                );
                                if let Some(ref cb) = req.on_retry {
                                    cb(AnalysisRetryPayload {
                                        attempt,
                                        max_retries: MAX_RETRIES,
                                        delay_ms: backoff.as_millis() as u64,
                                        status_code: Some(status.as_u16()),
                                        message: retry_msg,
                                    });
                                }
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
                        req.correlation_id,
                        attempt
                    );
                    if attempt <= MAX_RETRIES {
                        let backoff = compute_retry_backoff(attempt, None);
                        let retry_msg = "Network connection interrupted. Retrying...".to_string();
                        if let Some(ref cb) = req.on_retry {
                            cb(AnalysisRetryPayload {
                                attempt,
                                max_retries: MAX_RETRIES,
                                delay_ms: backoff.as_millis() as u64,
                                status_code: None,
                                message: retry_msg,
                            });
                        }
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

    pub async fn list_models(
        &self,
        api_key: &str,
        correlation_id: &str,
    ) -> Result<Vec<GeminiModelOption>, AppError> {
        let trimmed_key = api_key.trim();
        if trimmed_key.is_empty() {
            return Err(AppError::MissingApiKey);
        }

        let start_time = Instant::now();
        let mut raw_models: Vec<RawGeminiModelDto> = Vec::new();
        let mut page_token: Option<String> = None;
        let mut pages_fetched = 0;
        const MAX_PAGES: usize = 5;

        loop {
            pages_fetched += 1;
            let mut url = format!("{}?pageSize=1000", BASE_URL);
            if let Some(ref token) = page_token {
                url.push_str(&format!("&pageToken={}", token));
            }

            log::debug!(
                "[req_id={}] Fetching Gemini model catalog page {}...",
                correlation_id,
                pages_fetched
            );

            let res = self
                .client
                .get(&url)
                .header("x-goog-api-key", trimmed_key)
                .header("content-type", "application/json")
                .send()
                .await;

            let response = match res {
                Ok(resp) => resp,
                Err(e) => {
                    log::warn!(
                        "[req_id={}] Failed to connect to Gemini API: {e}",
                        correlation_id
                    );
                    return Err(AppError::NetworkTimeout(format!(
                        "Failed to connect to Gemini API: {e}"
                    )));
                }
            };

            let status = response.status();
            if !status.is_success() {
                let error_body = response.text().await.unwrap_or_default();
                let safe_snippet = Self::extract_error_message(&error_body);
                log::warn!(
                    "[req_id={}] models.list failed status={} error={}",
                    correlation_id,
                    status.as_u16(),
                    safe_snippet
                );
                return match status {
                    StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                        Err(AppError::UnauthorizedApiKey)
                    }
                    StatusCode::TOO_MANY_REQUESTS => Err(AppError::RateLimitExceeded(safe_snippet)),
                    _ if status.is_server_error() => {
                        Err(AppError::ProviderServerError(status.as_u16(), safe_snippet))
                    }
                    _ => Err(AppError::Analysis(format!(
                        "Failed to fetch model catalog ({}): {}",
                        status.as_u16(),
                        safe_snippet
                    ))),
                };
            }

            let body_text = response.text().await.map_err(|e| {
                AppError::NetworkTimeout(format!("Failed reading response body: {e}"))
            })?;

            let parsed: RawListModelsResponse = serde_json::from_str(&body_text).map_err(|e| {
                AppError::MalformedResponse(format!("Invalid model-list JSON: {e}"))
            })?;

            raw_models.extend(parsed.models);

            if let Some(token) = parsed.next_page_token {
                if !token.is_empty() && pages_fetched < MAX_PAGES {
                    page_token = Some(token);
                    continue;
                }
            }
            break;
        }

        let total_raw = raw_models.len();
        let candidates: Vec<RawGeminiModelDto> = raw_models
            .into_iter()
            .filter(is_text_analysis_candidate)
            .collect();

        let mut free_count = 0;
        let mut paid_count = 0;
        let mut unknown_count = 0;

        let mut model_options: Vec<GeminiModelOption> = candidates
            .into_iter()
            .map(|raw| {
                let id = raw
                    .name
                    .strip_prefix("models/")
                    .unwrap_or(&raw.name)
                    .to_string();
                let display_name = raw.display_name.unwrap_or_else(|| id.clone());
                let billing = classify_billing(&id);
                match billing {
                    BillingAvailability::FreeTierAvailable => free_count += 1,
                    BillingAvailability::PaidOnly => paid_count += 1,
                    BillingAvailability::Unknown => unknown_count += 1,
                }
                let thinking = match raw.thinking {
                    Some(serde_json::Value::Bool(b)) => b,
                    Some(serde_json::Value::Object(map)) => !map.is_empty(),
                    _ => false,
                };

                GeminiModelOption {
                    id,
                    display_name,
                    input_token_limit: raw.input_token_limit,
                    output_token_limit: raw.output_token_limit,
                    thinking,
                    billing_availability: billing,
                }
            })
            .collect();

        sort_model_catalog(&mut model_options);

        log::info!(
            "[req_id={}] models.list completed in {}ms: raw={} candidates={} (free={} paid={} unknown={})",
            correlation_id,
            start_time.elapsed().as_millis(),
            total_raw,
            model_options.len(),
            free_count,
            paid_count,
            unknown_count
        );

        Ok(model_options)
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
