# Gemini Structured Output & Analysis Pipeline

This document details the Gemini analysis integration, prompt versioning, structured schema contract, semantic validation rules, and error handling strategies implemented in Text Dynamics.

---

## 1. Architectural Guardrails

- **Rust-Originated Calls**: All HTTP requests to Google's Gemini REST API originate exclusively from Rust backend services (`src-tauri/src/gemini/`). The webview/browser frontend never directly contacts external LLM endpoints.
- **Direct REST Integration**: Uses standard `reqwest` over HTTPS against `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. No heavy multi-cloud SDKs, Vertex AI, or ADC service-account overheads are employed.
- **Zero Secret Exposure**: The user's Gemini API key is loaded on-demand from the OS credential store (Apple Keychain on macOS, Windows Credential Manager, Secret Service on Linux) and transmitted only in the `x-goog-api-key` HTTP request header. The key is never logged, persisted in SQLite, or exported to frontend state.

---

## 2. Configuration & Model Settings

| Parameter | Value / Default | Source / Configurable |
| :--- | :--- | :--- |
| **Default Model** | `gemini-3.8-flash` | Configurable in UI Settings (`settings` table `model_id`) |
| **API Endpoint** | `v1beta/models/{model}:generateContent` | Hardcoded REST endpoint |
| **Prompt Version** | `text-dynamics-1` | `src-tauri/src/analysis/prompt.rs` |
| **Schema Version** | `1.0` | `src-tauri/src/gemini/schema.rs` |
| **Temperature** | `0.2` | Generation configuration (low variance for analytical rigor) |
| **Response MIME** | `application/json` | Enforced structured JSON output |
| **Max Retries** | `3` | Exponential backoff (1s, 2s, 4s) for rate limits (429) & 5xx |

---

## 3. The Analysis Request Pipeline

1. **Deterministic Unitization**:
   - The document's raw content is unitized into contiguous `SourceUnit`s (stanzas, lines, or sentences) identified as `u0001`, `u0002`, etc., with exact character bounds.
2. **Correlation ID Generation**:
   - A unique request ID (`req_<uuid>`) is generated for tracing and logging.
3. **Prompt Composition**:
   - Assembles the core analytical instruction with any optional user custom instructions stored in settings.
   - Attaches the complete list of immutable source units as formatted JSON.
4. **Structured Schema Enforcement**:
   - Google's `response_schema` parameter is passed in the request body, strictly constraining the model output to valid JSON matching `CanonicalAnalysis`.
5. **HTTPS Transmission & Backoff**:
   - Transmitted via `reqwest::Client`.
   - On HTTP 429 (Rate Limit) or 5xx (Server Error), the client automatically pauses and retries up to 3 times with exponential backoff.
6. **Two-Stage Validation**:
   - **Syntactic Parsing**: Serde validates JSON compliance with `CanonicalAnalysis`.
   - **Semantic Integrity Check**: Validates unit coverage, contiguity, and ID references.

---

## 4. Structured JSON Schema (`response_schema`)

The Gemini API enforces the following OpenAPI/JSON schema structure:

```json
{
  "type": "OBJECT",
  "description": "Structured dynamic analysis of literary text",
  "properties": {
    "schema_version": { "type": "STRING" },
    "segments": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "id": { "type": "STRING" },
          "start_unit_id": { "type": "STRING" },
          "end_unit_id": { "type": "STRING" },
          "intensity": { "type": "NUMBER" },
          "tension": { "type": "NUMBER" },
          "valence": { "type": "NUMBER" },
          "temperature": { "type": "NUMBER" },
          "confidence": { "type": "NUMBER" },
          "rationale": { "type": "STRING" }
        },
        "required": [
          "id", "start_unit_id", "end_unit_id",
          "intensity", "tension", "valence", "temperature",
          "confidence", "rationale"
        ]
      }
    },
    "movements": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "id": { "type": "STRING" },
          "start_segment_id": { "type": "STRING" },
          "end_segment_id": { "type": "STRING" },
          "kind": {
            "type": "STRING",
            "enum": [
              "crescendo", "decrescendo", "spike", "drop",
              "plateau", "oscillation", "rupture", "reversal",
              "reset", "sustain"
            ]
          },
          "rationale": { "type": "STRING" }
        },
        "required": ["id", "start_segment_id", "end_segment_id", "kind", "rationale"]
      }
    },
    "phases": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "id": { "type": "STRING" },
          "name": { "type": "STRING" },
          "start_segment_id": { "type": "STRING" },
          "end_segment_id": { "type": "STRING" },
          "kind": {
            "type": "STRING",
            "enum": [
              "build_up", "climax", "break", "aftermath",
              "plateau", "oscillation", "other"
            ]
          },
          "rationale": { "type": "STRING" }
        },
        "required": ["id", "name", "start_segment_id", "end_segment_id", "kind", "rationale"]
      }
    }
  },
  "required": ["schema_version", "segments", "movements", "phases"]
}
```

---

## 5. Semantic Validation Rules (`validation.rs`)

Even when JSON syntax matches the schema, the analysis must satisfy domain invariants before being accepted and persisted:

1. **Source Unit Preservation**:
   - Every segment's `start_unit_id` and `end_unit_id` must exist in the original input unit list.
   - Start unit index must be $\le$ end unit index.
2. **Contiguous Full Coverage**:
   - The first segment must begin at the first source unit (`u0001`).
   - The last segment must terminate at the final source unit.
   - For any consecutive segments $S_i$ and $S_{i+1}$, $S_{i+1}.\text{start\_index} = S_i.\text{end\_index} + 1$. No gaps or overlapping segments are permitted.
3. **Metric Bounds**:
   - `intensity`: $[0.0, 10.0]$
   - `tension`: $[0.0, 10.0]$
   - `valence`: $[-10.0, 10.0]$
   - `temperature`: $[-10.0, 10.0]$
   - `confidence`: $[0.0, 1.0]$
4. **Referential Integrity**:
   - Movements and Phases must reference valid existing segment IDs.
   - Movement/Phase segment spans must be forward-ordered ($\text{start} \le \text{end}$).

---

## 6. Error Classification & Provider Handling

All errors are mapped to strongly typed `AppError` variants and converted into structured frontend error payloads `{ code: string, message: string }`:

| HTTP / Error Condition | `AppError` Variant | Frontend Code | User-Facing Action |
| :--- | :--- | :--- | :--- |
| **No API Key Found** | `MissingApiKey` | `missing_api_key` | Prompts user to configure key in Settings modal. |
| **HTTP 401 / 403** | `UnauthorizedApiKey` | `unauthorized_api_key` | Informs user that the key is invalid or rejected. |
| **HTTP 404** | `ModelNotFound` | `model_not_found` | Informs user that the configured model ID is invalid. |
| **HTTP 413 / Token Overflow** | `RequestTooLarge` | `request_too_large` | Alerts user that text exceeds provider token capacity. |
| **HTTP 429 (After Retries)**| `RateLimitExceeded` | `rate_limit_exceeded` | Instructs user to wait before requesting analysis again. |
| **Schema/Semantic Mismatch**| `InvalidSchema` / `Semantic`| `invalid_schema` / `semantic` | Diagnostic logged with request ID; user asked to retry. |
| **Network Timeout** | `NetworkTimeout` | `network_timeout` | Indicates internet connection or Google endpoint timeout. |
