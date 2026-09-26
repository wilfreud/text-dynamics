export type BillingAvailability = "free_tier_available" | "paid_only" | "unknown";

export interface GeminiModelOption {
  id: string;
  displayName: string;
  inputTokenLimit?: number | null;
  outputTokenLimit?: number | null;
  thinking: boolean;
  billingAvailability: BillingAvailability;
}

export interface AppSettings {
  hasApiKey: boolean;
  modelId: string;
  customInstruction: string;
  theme: "system" | "light" | "dark";
}

