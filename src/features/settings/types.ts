export interface AppSettings {
  hasApiKey: boolean;
  modelId: string;
  customInstruction: string;
  theme: "system" | "light" | "dark";
}
