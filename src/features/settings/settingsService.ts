import {
  ipcDeleteApiKey,
  ipcGetApiKeyStatus,
  ipcGetRuntimeDiagnostics,
  ipcGetSetting,
  ipcListGeminiModels,
  ipcSaveSetting,
  ipcSetApiKey,
} from "../../lib/tauri/ipc";
import { getLogger } from "../../lib/logging";
import type { ApiKeyStatus, AppSettings, RuntimeDiagnostics } from "./types";

const logger = getLogger(["settings"]);

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  try {
    return await ipcGetApiKeyStatus();
  } catch (error) {
    logger.error("Failed to fetch API key status: {error}", { error: String(error) });
    return { state: "error", message: String(error) };
  }
}

export async function checkApiKeyPresence(): Promise<boolean> {
  const status = await getApiKeyStatus();
  return status.state === "configured";
}

export async function fetchRuntimeDiagnostics(): Promise<RuntimeDiagnostics | null> {
  try {
    return await ipcGetRuntimeDiagnostics();
  } catch (error) {
    logger.error("Failed to fetch runtime diagnostics: {error}", { error: String(error) });
    return null;
  }
}

export async function updateApiKey(apiKey: string): Promise<void> {
  try {
    await ipcSetApiKey(apiKey);
    logger.info("API key updated successfully");
  } catch (error) {
    logger.error("Failed to update API key: {error}", { error: String(error) });
    throw error;
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    await ipcDeleteApiKey();
    logger.info("API key cleared");
  } catch (error) {
    logger.error("Failed to clear API key: {error}", { error: String(error) });
    throw error;
  }
}

export async function loadSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const val = await ipcGetSetting(key);
    return val ?? defaultValue;
  } catch (error) {
    logger.error("Failed to load setting key={key}: {error}", { key, error: String(error) });
    return defaultValue;
  }
}

export async function saveSetting(key: string, value: string): Promise<void> {
  try {
    await ipcSaveSetting(key, value);
    logger.info("Setting saved key={key}", { key });
  } catch (error) {
    logger.error("Failed to save setting key={key}: {error}", { key, error: String(error) });
    throw error;
  }
}

export async function loadAppSettings(): Promise<AppSettings> {
  const apiKeyStatus = await getApiKeyStatus();
  const hasApiKey = apiKeyStatus.state === "configured";
  let modelId = await loadSetting("model_id", "");
  if (!modelId) {
    modelId = await loadSetting("gemini_model", "gemini-3.8-flash");
  }
  const customInstruction = await loadSetting("custom_instruction", "");
  const theme = (await loadSetting("theme", "system")) as AppSettings["theme"];

  return {
    hasApiKey,
    apiKeyStatus,
    modelId: modelId || "gemini-3.8-flash",
    customInstruction,
    theme,
  };
}

export async function saveAppSettings(
  settings: Partial<Omit<AppSettings, "hasApiKey">>
): Promise<void> {
  if (settings.modelId !== undefined) {
    await saveSetting("model_id", settings.modelId);
    await saveSetting("gemini_model", settings.modelId);
  }
  if (settings.customInstruction !== undefined) {
    await saveSetting("custom_instruction", settings.customInstruction);
  }
  if (settings.theme !== undefined) {
    await saveSetting("theme", settings.theme);
  }
}

export async function fetchGeminiModelCatalog(): Promise<import("./types").GeminiModelOption[]> {
  const dtos = await ipcListGeminiModels();
  return dtos.map((dto) => ({
    id: dto.id,
    displayName: dto.display_name,
    inputTokenLimit: dto.input_token_limit,
    outputTokenLimit: dto.output_token_limit,
    thinking: dto.thinking,
    billingAvailability: dto.billing_availability,
  }));
}

