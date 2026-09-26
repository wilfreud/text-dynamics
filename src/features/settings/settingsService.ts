import {
  ipcDeleteApiKey,
  ipcGetSetting,
  ipcHasApiKey,
  ipcSaveSetting,
  ipcSetApiKey,
} from "../../lib/tauri/ipc";
import { getLogger } from "../../lib/logging";

const logger = getLogger(["settings"]);

export async function checkApiKeyPresence(): Promise<boolean> {
  try {
    return await ipcHasApiKey();
  } catch (error) {
    logger.error("Failed to check API key presence: {error}", { error: String(error) });
    return false;
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
