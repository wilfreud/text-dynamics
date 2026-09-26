use serde::{Deserialize, Serialize};

/// Official documentation URL for Standard Gemini API pricing.
pub const PRICING_DOCS_URL: &str = "https://ai.google.dev/gemini-api/docs/pricing";

/// Research snapshot date for the Standard Gemini API Free Tier catalog.
pub const CATALOG_VERIFIED_DATE: &str = "2026-09-26";

/// Billing tier classification for Gemini models under Standard Gemini API.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BillingAvailability {
    /// Has a Standard Gemini API Free Tier with rate limits (RPM/RPD) according to official docs.
    FreeTierAvailable,
    /// Standard Gemini API Paid-only tier according to official docs.
    PaidOnly,
    /// Unmapped or newly returned model; never guess based on name heuristics.
    Unknown,
}

/// Normalized model metadata returned to frontend for candidate selection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiModelOption {
    pub id: String,
    pub display_name: String,
    pub input_token_limit: Option<u32>,
    pub output_token_limit: Option<u32>,
    pub thinking: bool,
    pub billing_availability: BillingAvailability,
}

/// Raw model object returned by `GET https://generativelanguage.googleapis.com/v1beta/models`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawGeminiModelDto {
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub input_token_limit: Option<u32>,
    pub output_token_limit: Option<u32>,
    #[serde(default)]
    pub supported_generation_methods: Vec<String>,
    #[serde(default)]
    pub thinking: Option<serde_json::Value>,
}

/// Raw response wrapper for `models.list`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawListModelsResponse {
    #[serde(default)]
    pub models: Vec<RawGeminiModelDto>,
    pub next_page_token: Option<String>,
}

/// Determines whether a provider model is a viable candidate for text dynamics analysis.
///
/// Requires `generateContent` support, belongs to the `gemini-*` family, and excludes
/// specialized non-text or multimodal-only models (embedding, audio, imagen, live/realtime, etc.).
pub fn is_text_analysis_candidate(raw: &RawGeminiModelDto) -> bool {
    let supports_generate = raw
        .supported_generation_methods
        .iter()
        .any(|m| m == "generateContent");
    if !supports_generate {
        return false;
    }

    let id = raw.name.strip_prefix("models/").unwrap_or(&raw.name);
    let id_lower = id.to_lowercase();
    if !id_lower.starts_with("gemini-") {
        return false;
    }

    let is_specialized = id_lower.contains("embedding")
        || id_lower.contains("imagen")
        || id_lower.contains("audio")
        || id_lower.contains("realtime")
        || id_lower.contains("live")
        || id_lower.contains("tts")
        || id_lower.contains("transcription")
        || id_lower.contains("whisper")
        || id_lower.contains("veo")
        || id_lower.contains("robotics");

    !is_specialized
}

/// Classifies billing availability based strictly on the verified official pricing snapshot.
///
/// Returns `Unknown` for any model not explicitly in the snapshot catalog.
pub fn classify_billing(model_id: &str) -> BillingAvailability {
    match model_id {
        "gemini-3.8-flash"
        | "gemini-3.7-flash"
        | "gemini-3.6-flash"
        | "gemini-3.5-flash"
        | "gemini-3.5-flash-lite"
        | "gemini-3.1-flash-lite"
        | "gemini-3-flash-preview"
        | "gemini-2.5-pro"
        | "gemini-2.5-flash"
        | "gemini-2.5-flash-lite" => BillingAvailability::FreeTierAvailable,

        "gemini-3.1-pro-preview" | "gemini-3.1-pro-preview-customtools" => {
            BillingAvailability::PaidOnly
        }

        _ => BillingAvailability::Unknown,
    }
}

const PREFERENCE_ORDER: &[&str] = &[
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-3.1-pro-preview-customtools",
];

fn preference_rank(id: &str) -> usize {
    PREFERENCE_ORDER
        .iter()
        .position(|&p| p == id)
        .unwrap_or(usize::MAX)
}

fn billing_rank(b: BillingAvailability) -> u8 {
    match b {
        BillingAvailability::FreeTierAvailable => 0,
        BillingAvailability::PaidOnly => 1,
        BillingAvailability::Unknown => 2,
    }
}

/// Predictable sorting:
/// 1. FreeTierAvailable < PaidOnly < Unknown
/// 2. Within category: explicit capability preference list
/// 3. Alphabetical by display name
pub fn sort_model_catalog(models: &mut [GeminiModelOption]) {
    models.sort_by(|a, b| {
        let b_rank_a = billing_rank(a.billing_availability);
        let b_rank_b = billing_rank(b.billing_availability);
        if b_rank_a != b_rank_b {
            return b_rank_a.cmp(&b_rank_b);
        }

        let p_rank_a = preference_rank(&a.id);
        let p_rank_b = preference_rank(&b.id);
        if p_rank_a != p_rank_b {
            return p_rank_a.cmp(&p_rank_b);
        }

        a.display_name.cmp(&b.display_name)
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_candidate_filtering() {
        let text_model = RawGeminiModelDto {
            name: "models/gemini-3.8-flash".into(),
            display_name: Some("Gemini 3.8 Flash".into()),
            description: None,
            input_token_limit: Some(1048576),
            output_token_limit: Some(8192),
            supported_generation_methods: vec!["generateContent".into()],
            thinking: None,
        };
        assert!(is_text_analysis_candidate(&text_model));

        let embedding_model = RawGeminiModelDto {
            name: "models/gemini-embedding-001".into(),
            display_name: Some("Gemini Embedding".into()),
            description: None,
            input_token_limit: Some(2048),
            output_token_limit: None,
            supported_generation_methods: vec!["generateContent".into()],
            thinking: None,
        };
        assert!(!is_text_analysis_candidate(&embedding_model));

        let non_gemini = RawGeminiModelDto {
            name: "models/imagen-3.0".into(),
            display_name: Some("Imagen 3".into()),
            description: None,
            input_token_limit: None,
            output_token_limit: None,
            supported_generation_methods: vec!["generateContent".into()],
            thinking: None,
        };
        assert!(!is_text_analysis_candidate(&non_gemini));

        let unsupported_method = RawGeminiModelDto {
            name: "models/gemini-2.5-flash".into(),
            display_name: Some("Gemini 2.5 Flash".into()),
            description: None,
            input_token_limit: Some(1048576),
            output_token_limit: Some(8192),
            supported_generation_methods: vec!["embedContent".into()],
            thinking: None,
        };
        assert!(!is_text_analysis_candidate(&unsupported_method));
    }

    #[test]
    fn test_billing_classification() {
        assert_eq!(
            classify_billing("gemini-3.8-flash"),
            BillingAvailability::FreeTierAvailable
        );
        assert_eq!(
            classify_billing("gemini-2.5-pro"),
            BillingAvailability::FreeTierAvailable
        );
        assert_eq!(
            classify_billing("gemini-3.1-pro-preview"),
            BillingAvailability::PaidOnly
        );
        assert_eq!(
            classify_billing("gemini-9.9-ultra-future"),
            BillingAvailability::Unknown
        );
    }

    #[test]
    fn test_catalog_sorting() {
        let mut list = vec![
            GeminiModelOption {
                id: "gemini-future".into(),
                display_name: "Future Gemini".into(),
                input_token_limit: None,
                output_token_limit: None,
                thinking: false,
                billing_availability: BillingAvailability::Unknown,
            },
            GeminiModelOption {
                id: "gemini-3.1-pro-preview".into(),
                display_name: "Gemini 3.1 Pro Preview".into(),
                input_token_limit: None,
                output_token_limit: None,
                thinking: false,
                billing_availability: BillingAvailability::PaidOnly,
            },
            GeminiModelOption {
                id: "gemini-2.5-flash".into(),
                display_name: "Gemini 2.5 Flash".into(),
                input_token_limit: None,
                output_token_limit: None,
                thinking: false,
                billing_availability: BillingAvailability::FreeTierAvailable,
            },
            GeminiModelOption {
                id: "gemini-3.8-flash".into(),
                display_name: "Gemini 3.8 Flash".into(),
                input_token_limit: None,
                output_token_limit: None,
                thinking: false,
                billing_availability: BillingAvailability::FreeTierAvailable,
            },
        ];

        sort_model_catalog(&mut list);

        assert_eq!(list[0].id, "gemini-3.8-flash");
        assert_eq!(list[1].id, "gemini-2.5-flash");
        assert_eq!(list[2].id, "gemini-3.1-pro-preview");
        assert_eq!(list[3].id, "gemini-future");
    }
}
