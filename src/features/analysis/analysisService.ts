import {
  ipcAnalyzeDocument,
  ipcGetAnalysisOverrides,
  ipcGetLatestAnalysis,
  ipcSaveAnalysisOverrides,
  type AnalysisRecordDto,
} from "../../lib/tauri/ipc";
import { getLogger } from "../../lib/logging";
import type { CanonicalAnalysis, UserOverrides } from "./types";

const logger = getLogger(["analysis"]);

export interface AnalysisModelResult {
  record: AnalysisRecordDto;
  analysis: CanonicalAnalysis;
  overrides?: UserOverrides;
}

export async function requestDocumentAnalysis(
  documentId: string,
  customInstruction?: string,
  modelOverride?: string
): Promise<AnalysisModelResult> {
  logger.info("Requesting analysis for document id={documentId}", { documentId });
  const record = await ipcAnalyzeDocument(documentId, customInstruction, modelOverride);

  const analysis: CanonicalAnalysis = JSON.parse(record.raw_analysis_json);
  let overrides: UserOverrides | undefined;

  const overridesDto = await ipcGetAnalysisOverrides(record.id);
  if (overridesDto) {
    try {
      overrides = JSON.parse(overridesDto.overrides_json);
    } catch {
      // Keep empty if invalid JSON
    }
  }

  return { record, analysis, overrides };
}

export async function fetchLatestAnalysis(
  documentId: string
): Promise<AnalysisModelResult | null> {
  const record = await ipcGetLatestAnalysis(documentId);
  if (!record) return null;

  const analysis: CanonicalAnalysis = JSON.parse(record.raw_analysis_json);
  let overrides: UserOverrides | undefined;

  const overridesDto = await ipcGetAnalysisOverrides(record.id);
  if (overridesDto) {
    try {
      overrides = JSON.parse(overridesDto.overrides_json);
    } catch {
      // Keep empty
    }
  }

  return { record, analysis, overrides };
}

export async function saveUserOverrides(
  analysisId: string,
  overrides: UserOverrides
): Promise<void> {
  const jsonStr = JSON.stringify(overrides);
  await ipcSaveAnalysisOverrides(analysisId, jsonStr);
}
