export type BillingAvailability = "free_tier_available" | "paid_only" | "unknown";

export interface GeminiModelOption {
  id: string;
  displayName: string;
  inputTokenLimit?: number | null;
  outputTokenLimit?: number | null;
  thinking: boolean;
  billingAvailability: BillingAvailability;
}

export type ApiKeyStatus =
  | { state: "configured" }
  | { state: "missing" }
  | { state: "error"; message: string };

export interface CredentialDiagnostics {
  backend: string;
  service: string;
  account: string;
  status: ApiKeyStatus;
}

export interface DatabaseDiagnostics {
  backend: string;
  uri: string;
  resolvedPath: string;
  status: string;
}

export interface RuntimeDiagnostics {
  credential: CredentialDiagnostics;
  database: DatabaseDiagnostics;
}

export interface AppSettings {
  hasApiKey: boolean;
  apiKeyStatus: ApiKeyStatus;
  modelId: string;
  customInstruction: string;
  theme: "system" | "light" | "dark";
}
