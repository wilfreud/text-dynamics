export type ErrorCategory =
  | "missing_api_key"
  | "unauthorized_api_key"
  | "rate_limit_exceeded"
  | "model_not_found"
  | "request_too_large"
  | "network_timeout"
  | "provider_server_error"
  | "invalid_analysis"
  | "database_error"
  | "secret_storage_error"
  | "unknown";

export interface ParsedAppError {
  category: ErrorCategory;
  title: string;
  message: string;
  isActionableApiKey: boolean;
  raw?: unknown;
}

export function parseAppError(error: unknown): ParsedAppError {
  let kind = "";
  let message = "";

  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.kind === "string") {
      kind = errObj.kind;
    }
    if (typeof errObj.message === "string") {
      message = errObj.message;
    } else if (typeof errObj.toString === "function") {
      message = errObj.toString();
    }
  } else if (typeof error === "string") {
    // Check if error string is JSON serialized AppError
    try {
      const parsed = JSON.parse(error);
      if (typeof parsed === "object" && parsed !== null) {
        if (typeof parsed.kind === "string") kind = parsed.kind;
        if (typeof parsed.message === "string") message = parsed.message;
      }
    } catch {
      message = error;
    }
  } else {
    message = String(error);
  }

  // Fallback matching if kind is empty but message contains recognizable substrings
  const lowerMsg = message.toLowerCase();
  if (!kind) {
    if (lowerMsg.includes("missing api key") || lowerMsg.includes("missing_api_key")) {
      kind = "missing_api_key";
    } else if (lowerMsg.includes("unauthorized") || lowerMsg.includes("invalid api key")) {
      kind = "unauthorized_api_key";
    } else if (lowerMsg.includes("rate limit") || lowerMsg.includes("quota")) {
      kind = "rate_limit_exceeded";
    } else if (lowerMsg.includes("model not found")) {
      kind = "model_not_found";
    } else if (lowerMsg.includes("too large") || lowerMsg.includes("token limit")) {
      kind = "request_too_large";
    } else if (lowerMsg.includes("network") || lowerMsg.includes("timeout")) {
      kind = "network_timeout";
    } else if (lowerMsg.includes("database") || lowerMsg.includes("rusqlite")) {
      kind = "database_error";
    }
  }

  switch (kind) {
    case "missing_api_key":
      return {
        category: "missing_api_key",
        title: "API Key Required",
        message: "No Gemini API key found. Please configure your API key in Settings to run analysis.",
        isActionableApiKey: true,
        raw: error,
      };

    case "unauthorized_api_key":
      return {
        category: "unauthorized_api_key",
        title: "Invalid API Key",
        message: "The configured Gemini API key was rejected by Google. Please check your key in Settings.",
        isActionableApiKey: true,
        raw: error,
      };

    case "rate_limit_exceeded":
      return {
        category: "rate_limit_exceeded",
        title: "Rate Limit Exceeded",
        message: message || "Gemini quota or rate limit exceeded. Please wait a moment before trying again.",
        isActionableApiKey: false,
        raw: error,
      };

    case "model_not_found":
      return {
        category: "model_not_found",
        title: "Model Not Available",
        message: message || "The requested Gemini model is not accessible or not found.",
        isActionableApiKey: false,
        raw: error,
      };

    case "request_too_large":
      return {
        category: "request_too_large",
        title: "Text Too Large",
        message: message || "The input text exceeds the maximum context length for this model.",
        isActionableApiKey: false,
        raw: error,
      };

    case "network_timeout":
      return {
        category: "network_timeout",
        title: "Connection Timed Out",
        message: message || "Could not reach Gemini API. Please check your network connection.",
        isActionableApiKey: false,
        raw: error,
      };

    case "provider_server_error":
      return {
        category: "provider_server_error",
        title: "Gemini Server Error",
        message: message || "Gemini upstream server encountered an error. Please try again shortly.",
        isActionableApiKey: false,
        raw: error,
      };

    case "malformed_response":
    case "semantic_validation_failed":
    case "analysis_error":
      return {
        category: "invalid_analysis",
        title: "Analysis Generation Failed",
        message: message || "The model generated output that failed structural or semantic validation.",
        isActionableApiKey: false,
        raw: error,
      };

    case "database_error":
    case "document_not_found":
      return {
        category: "database_error",
        title: "Storage Error",
        message: message || "A local database error occurred.",
        isActionableApiKey: false,
        raw: error,
      };

    case "secret_storage_error":
      return {
        category: "secret_storage_error",
        title: "Credential Store Error",
        message: message || "Failed to access OS credential store.",
        isActionableApiKey: true,
        raw: error,
      };

    default:
      return {
        category: "unknown",
        title: "Operation Failed",
        message: message || "An unexpected error occurred.",
        isActionableApiKey: false,
        raw: error,
      };
  }
}
