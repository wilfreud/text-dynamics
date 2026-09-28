import type { AnalysisSegment } from "../types";
import type { SourceUnit } from "../unitization/unitizer";
import { resolveSegmentOffsets } from "../unitization/unitizer";

export interface PassagePreview {
  kind: "full" | "head-tail";
  text: string;
  head?: string;
  tail?: string;
  omittedCharacterCount?: number;
}

export interface PassagePreviewOptions {
  /** Maximum character length before switching to head-tail preview. Defaults to 200. */
  fullThreshold?: number;
  /** Approximate character target for the head preview. Defaults to 110. */
  headTarget?: number;
  /** Approximate character target for the tail preview. Defaults to 80. */
  tailTarget?: number;
}

export interface ResolvedPassage {
  passage: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  startUnitId: string;
  endUnitId: string;
  characterCount: number;
  unitRangeLabel: string;
  isValid: boolean;
}

/**
 * Deterministically resolves the exact source passage from the original text
 * using the segment's unit boundaries. Never paraphrases or modifies source text.
 */
export function getSegmentSourcePassage(
  sourceText: string,
  segment: Pick<AnalysisSegment, "startUnitId" | "endUnitId">,
  units: SourceUnit[]
): ResolvedPassage | null {
  const resolved = resolveSegmentOffsets(segment, units);
  if (!resolved) {
    return null;
  }

  const { startOffset, endOffset, startLine, endLine } = resolved;

  const startId = segment.startUnitId ?? (segment as any).start_unit_id ?? "";
  const endId = segment.endUnitId ?? (segment as any).end_unit_id ?? "";

  // Defensive validation of boundaries
  if (
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset > sourceText.length ||
    startOffset >= endOffset
  ) {
    return {
      passage: "",
      startOffset,
      endOffset,
      startLine,
      endLine,
      startUnitId: startId,
      endUnitId: endId,
      characterCount: 0,
      unitRangeLabel: startId === endId ? startId : `${startId}–${endId}`,
      isValid: false,
    };
  }

  const passage = sourceText.slice(startOffset, endOffset);
  const unitRangeLabel =
    startId === endId
      ? startId
      : `${startId}–${endId}`;

  return {
    passage,
    startOffset,
    endOffset,
    startLine,
    endLine,
    startUnitId: startId,
    endUnitId: endId,
    characterCount: passage.length,
    unitRangeLabel,
    isValid: true,
  };
}

/**
 * Creates a deterministic, boundary-aware compact preview of a source passage.
 * Short passages are returned in full. Long passages return a head-tail preview
 * showing both the beginning and the end of the segment.
 */
export function createPassagePreview(
  text: string,
  options: PassagePreviewOptions = {}
): PassagePreview {
  if (!text) {
    return { kind: "full", text: "" };
  }

  const fullThreshold = options.fullThreshold ?? 200;
  const headTarget = options.headTarget ?? 110;
  const tailTarget = options.tailTarget ?? 80;

  // If passage is short enough, return in full preserving exact content & breaks
  if (text.length <= fullThreshold) {
    return {
      kind: "full",
      text,
    };
  }

  // Guard against abnormal target combinations
  if (headTarget + tailTarget >= text.length) {
    return {
      kind: "full",
      text,
    };
  }

  // 1. Find a natural boundary for the head cut near headTarget
  const headCut = findForwardBoundary(text, headTarget, 24);
  let head = text.slice(0, headCut);
  // Strip trailing whitespace/separators from head display
  head = head.replace(/[\s,;:\-–—\.]+$/, "");

  // 2. Find a natural boundary for the tail cut near (text.length - tailTarget)
  const tailStartTarget = text.length - tailTarget;
  const tailStart = findBackwardBoundary(text, tailStartTarget, 24);
  let tail = text.slice(tailStart);
  // Strip leading whitespace/separators from tail display
  tail = tail.replace(/^[\s,;:\-–—\.]+/, "");

  const omittedCharacterCount = Math.max(0, text.length - head.length - tail.length);

  return {
    kind: "head-tail",
    text: `${head}…\n…${tail}`,
    head,
    tail,
    omittedCharacterCount,
  };
}

/**
 * Finds a natural break point (whitespace or punctuation) near targetOffset,
 * scanning within windowSize.
 */
function findForwardBoundary(
  text: string,
  targetOffset: number,
  windowSize: number
): number {
  const minPos = Math.max(0, targetOffset - windowSize);
  const maxPos = Math.min(text.length, targetOffset + windowSize);

  // Look for whitespace boundary first
  for (let i = targetOffset; i <= maxPos; i++) {
    if (/\s/.test(text[i])) return i;
  }
  for (let i = targetOffset; i >= minPos; i--) {
    if (/\s/.test(text[i])) return i;
  }

  // Look for punctuation boundary
  for (let i = targetOffset; i <= maxPos; i++) {
    if (/[,;:\.\?!]/.test(text[i])) return i + 1;
  }
  for (let i = targetOffset; i >= minPos; i--) {
    if (/[,;:\.\?!]/.test(text[i])) return i + 1;
  }

  return targetOffset;
}

/**
 * Finds a natural start break point (whitespace or punctuation) near targetOffset
 * for the tail of the preview.
 */
function findBackwardBoundary(
  text: string,
  targetOffset: number,
  windowSize: number
): number {
  const minPos = Math.max(0, targetOffset - windowSize);
  const maxPos = Math.min(text.length, targetOffset + windowSize);

  // Look for whitespace boundary near targetOffset
  for (let i = targetOffset; i >= minPos; i--) {
    if (/\s/.test(text[i])) return i + 1;
  }
  for (let i = targetOffset; i <= maxPos; i++) {
    if (/\s/.test(text[i])) return i + 1;
  }

  // Look for punctuation boundary
  for (let i = targetOffset; i >= minPos; i--) {
    if (/[,;:\.\?!]/.test(text[i])) return i + 1;
  }
  for (let i = targetOffset; i <= maxPos; i++) {
    if (/[,;:\.\?!]/.test(text[i])) return i + 1;
  }

  return targetOffset;
}
