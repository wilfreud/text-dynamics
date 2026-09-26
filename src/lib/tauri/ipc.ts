import { invoke } from "@tauri-apps/api/core";
import { getLogger } from "../logging";

const logger = getLogger(["ipc"]);

export interface DocumentRecordDto {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentSummaryDto {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  char_count: number;
  line_count: number;
}

export async function ipcCreateDocument(title: string, content: string): Promise<DocumentRecordDto> {
  logger.debug("IPC: create_document title={title}", { title });
  return invoke<DocumentRecordDto>("create_document", { title, content });
}

export async function ipcGetDocument(id: string): Promise<DocumentRecordDto> {
  logger.debug("IPC: get_document id={id}", { id });
  return invoke<DocumentRecordDto>("get_document", { id });
}

export async function ipcUpdateDocument(
  id: string,
  title?: string,
  content?: string
): Promise<DocumentRecordDto> {
  logger.debug("IPC: update_document id={id}", { id });
  return invoke<DocumentRecordDto>("update_document", { id, title, content });
}

export async function ipcDeleteDocument(id: string): Promise<void> {
  logger.debug("IPC: delete_document id={id}", { id });
  return invoke<void>("delete_document", { id });
}

export async function ipcListDocuments(): Promise<DocumentSummaryDto[]> {
  logger.debug("IPC: list_documents");
  return invoke<DocumentSummaryDto[]>("list_documents");
}

export async function ipcGetSetting(key: string): Promise<string | null> {
  logger.debug("IPC: get_setting key={key}", { key });
  return invoke<string | null>("get_setting", { key });
}

export async function ipcSaveSetting(key: string, value: string): Promise<void> {
  logger.debug("IPC: save_setting key={key}", { key });
  return invoke<void>("save_setting", { key, value });
}

export async function ipcHasApiKey(): Promise<boolean> {
  logger.debug("IPC: has_api_key");
  return invoke<boolean>("has_api_key");
}

export async function ipcSetApiKey(apiKey: string): Promise<void> {
  logger.debug("IPC: set_api_key");
  return invoke<void>("set_api_key", { apiKey });
}

export async function ipcDeleteApiKey(): Promise<void> {
  logger.debug("IPC: delete_api_key");
  return invoke<void>("delete_api_key");
}
