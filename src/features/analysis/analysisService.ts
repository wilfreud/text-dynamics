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

export function normalizeCanonicalAnalysis(raw: any): CanonicalAnalysis {
  if (!raw) return raw;
  return {
    schemaVersion: raw.schemaVersion ?? raw.schema_version ?? "1.0",
    segments: (raw.segments ?? []).map((s: any) => ({
      ...s,
      startUnitId: s.startUnitId ?? s.start_unit_id ?? "",
      endUnitId: s.endUnitId ?? s.end_unit_id ?? "",
    })),
    movements: (raw.movements ?? []).map((m: any) => ({
      ...m,
      startSegmentId: m.startSegmentId ?? m.start_segment_id ?? "",
      endSegmentId: m.endSegmentId ?? m.end_segment_id ?? "",
    })),
    phases: (raw.phases ?? []).map((p: any) => ({
      ...p,
      startSegmentId: p.startSegmentId ?? p.start_segment_id ?? "",
      endSegmentId: p.endSegmentId ?? p.end_segment_id ?? "",
    })),
    overall: {
      summary: raw.overall?.summary ?? "",
      dominantShape:
        raw.overall?.dominantShape ?? raw.overall?.dominant_shape ?? "",
    },
  };
}

export interface AnalysisModelResult {
  record: AnalysisRecordDto;
  analysis: CanonicalAnalysis;
  overrides?: UserOverrides;
}

export async function requestDocumentAnalysis(
  documentId: string,
  customInstruction?: string,
  modelOverride?: string,
  units?: Array<{ id: string; text: string }>
): Promise<AnalysisModelResult> {
  logger.info("Requesting analysis for document id={documentId} units={unitCount}", {
    documentId,
    unitCount: units?.length,
  });
  const record = await ipcAnalyzeDocument(documentId, customInstruction, modelOverride, units);

  const rawParsed = JSON.parse(record.raw_analysis_json);
  const analysis: CanonicalAnalysis = normalizeCanonicalAnalysis(rawParsed);
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

  const rawParsed = JSON.parse(record.raw_analysis_json);
  const analysis: CanonicalAnalysis = normalizeCanonicalAnalysis(rawParsed);
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
