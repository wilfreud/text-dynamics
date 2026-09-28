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

export async function ipcGetApiKeyStatus(): Promise<import("../../features/settings/types").ApiKeyStatus> {
  logger.debug("IPC: get_api_key_status");
  return invoke<import("../../features/settings/types").ApiKeyStatus>("get_api_key_status");
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

export async function ipcGetRuntimeDiagnostics(): Promise<import("../../features/settings/types").RuntimeDiagnostics> {
  logger.debug("IPC: get_runtime_diagnostics");
  return invoke<import("../../features/settings/types").RuntimeDiagnostics>("get_runtime_diagnostics");
}


export type BillingAvailability = "free_tier_available" | "paid_only" | "unknown";

export interface GeminiModelOptionDto {
  id: string;
  display_name: string;
  input_token_limit?: number | null;
  output_token_limit?: number | null;
  thinking: boolean;
  billing_availability: BillingAvailability;
}

export async function ipcListGeminiModels(): Promise<GeminiModelOptionDto[]> {
  logger.debug("IPC: list_gemini_models");
  return invoke<GeminiModelOptionDto[]>("list_gemini_models");
}

export interface AnalysisRecordDto {
  id: string;
  document_id: string;
  schema_version: string;
  model_id: string;
  prompt_version: string;
  raw_analysis_json: string;
  created_at: string;
}

export interface AnalysisOverridesRecordDto {
  analysis_id: string;
  overrides_json: string;
  updated_at: string;
}

export interface AnalysisRetryPayload {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  statusCode?: number;
  message: string;
}

export interface AnalysisAttemptPayload {
  attempt: number;
  maxAttempts: number;
}

export async function ipcAnalyzeDocument(
  documentId: string,
  customInstruction?: string,
  modelOverride?: string,
  units?: Array<{ id: string; text: string }>
): Promise<AnalysisRecordDto> {
  logger.info("IPC: analyze_document doc_id={documentId} units={unitCount}", {
    documentId,
    unitCount: units?.length,
  });
  return invoke<AnalysisRecordDto>("analyze_document", {
    documentId,
    customInstruction,
    modelOverride,
    units,
  });
}

export async function ipcGetLatestAnalysis(
  documentId: string
): Promise<AnalysisRecordDto | null> {
  logger.debug("IPC: get_latest_analysis doc_id={documentId}", { documentId });
  return invoke<AnalysisRecordDto | null>("get_latest_analysis", { documentId });
}

export async function ipcSaveAnalysisOverrides(
  analysisId: string,
  overridesJson: string
): Promise<AnalysisOverridesRecordDto> {
  logger.debug("IPC: save_analysis_overrides analysis_id={analysisId}", { analysisId });
  return invoke<AnalysisOverridesRecordDto>("save_analysis_overrides", {
    analysisId,
    overridesJson,
  });
}

export async function ipcGetAnalysisOverrides(
  analysisId: string
): Promise<AnalysisOverridesRecordDto | null> {
  logger.debug("IPC: get_analysis_overrides analysis_id={analysisId}", { analysisId });
  return invoke<AnalysisOverridesRecordDto | null>("get_analysis_overrides", {
    analysisId,
  });
}

export async function ipcSyncWordWrapMenu(checked: boolean): Promise<void> {
  return invoke<void>("sync_word_wrap_menu", { checked });
}

export interface ActivityEventDto {
  id: string;
  createdAt: string;
  sessionId: string;
  documentId: string | null;
  category: string;
  eventName: string;
  level: string;
  message: string | null;
  metadataJson: string | null;
  source: string;
}

export interface SessionSummaryDto {
  sessionId: string;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  isCurrent: boolean;
}

export interface ActivityEventsFilterDto {
  query?: string;
  sessionId?: string;
  documentId?: string;
  level?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityEventsResponseDto {
  events: ActivityEventDto[];
  totalCount: number;
  hasMore: boolean;
}

export interface DiagnosticLogEntryDto {
  id: string;
  timestamp: string;
  level: string;
  sessionId: string | null;
  documentId: string | null;
  component: string | null;
  message: string;
  rawLine: string;
}

export interface DiagnosticLogsFilterDto {
  query?: string;
  sessionId?: string;
  documentId?: string;
  level?: string;
  component?: string;
  limit?: number;
  offset?: number;
}

export interface DiagnosticLogsResponseDto {
  entries: DiagnosticLogEntryDto[];
  totalCount: number;
  hasMore: boolean;
}

export async function ipcListActivityEvents(
  filter: ActivityEventsFilterDto
): Promise<ActivityEventsResponseDto> {
  return invoke<ActivityEventsResponseDto>("list_activity_events", { filter });
}

export async function ipcListSessions(): Promise<SessionSummaryDto[]> {
  return invoke<SessionSummaryDto[]>("list_sessions");
}

export async function ipcGetCurrentSessionId(): Promise<string> {
  return invoke<string>("get_current_session_id");
}

export async function ipcListDiagnosticLogs(
  filter: DiagnosticLogsFilterDto
): Promise<DiagnosticLogsResponseDto> {
  return invoke<DiagnosticLogsResponseDto>("list_diagnostic_logs", { filter });
}

export async function ipcOpenLogsFolder(): Promise<void> {
  return invoke<void>("open_logs_folder");
}

export async function ipcClearActivityHistory(): Promise<void> {
  return invoke<void>("clear_activity_history");
}

export async function ipcClearDiagnosticLogs(): Promise<void> {
  return invoke<void>("clear_diagnostic_logs");
}

