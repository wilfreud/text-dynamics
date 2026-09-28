export type AtomicUnitKind =
  | "sentence"
  | "poetic-line"
  | "clause-fallback"
  | "length-fallback";

export interface SourceParagraph {
  /** Stable identifier formatted as p001, p002, etc. */
  id: string;
  /** Sequential zero-based index of the paragraph */
  index: number;
  /** UTF-16 start offset in original source */
  startOffset: number;
  /** UTF-16 end offset in original source */
  endOffset: number;
  /** Line IDs belonging to this paragraph */
  lineIds: string[];
}

export interface SourceLine {
  /** Stable identifier formatted as l0001, l0002, etc. */
  id: string;
  /** Paragraph ID this line belongs to */
  paragraphId: string;
  /** Physical zero-based line index in the source text */
  index: number;
  /** UTF-16 start offset in original source */
  startOffset: number;
  /** UTF-16 end offset in original source */
  endOffset: number;
  /** Exact line text */
  text: string;
  /** Whether the line contains only whitespace */
  isBlank: boolean;
}

export interface SourceUnit {
  /** Stable identifier formatted as u0001, u0002, etc. */
  id: string;
  /** Sequential zero-based index of the non-empty unit */
  index: number;
  /** Exact trimmed text content of the unit for model consumption */
  text: string;
  /** Physical zero-based line index in the source text */
  lineIndex: number;
  /** Zero-based stanza / paragraph index grouping contiguous non-empty lines */
  stanzaIndex: number;
  /** Paragraph ID (p001, etc.) */
  paragraphId: string;
  /** Line ID (l0001, etc.) */
  lineId: string;
  /** Classification of atomic unit */
  kind: AtomicUnitKind;
  /** UTF-16 start offset in original source for textarea.setSelectionRange */
  startIndex: number;
  /** UTF-16 end offset in original source for textarea.setSelectionRange */
  endIndex: number;
}

export interface UnitizationResult {
  /** Original untampered source text */
  source: string;
  /** Ordered list of atomic units */
  units: SourceUnit[];
  /** Preserved paragraph/stanza structures */
  paragraphs: SourceParagraph[];
  /** Preserved physical lines */
  lines: SourceLine[];
  /** Total physical line count */
  totalLines: number;
  /** Total detected stanzas / paragraphs */
  stanzaCount: number;
}

/** Formats a zero-based unit index into a stable unit ID (e.g. u0001). */
export function formatUnitId(unitIndex: number): string {
  const numberPart = (unitIndex + 1).toString().padStart(4, "0");
  return `u${numberPart}`;
}

/** Formats a zero-based paragraph index into a stable ID (e.g. p001). */
export function formatParagraphId(paragraphIndex: number): string {
  const numberPart = (paragraphIndex + 1).toString().padStart(3, "0");
  return `p${numberPart}`;
}

/** Formats a zero-based line index into a stable ID (e.g. l0001). */
export function formatLineId(lineIndex: number): string {
  const numberPart = (lineIndex + 1).toString().padStart(4, "0");
  return `l${numberPart}`;
}

const MAX_ATOMIC_UNIT_LENGTH = 500;

interface CandidateSpan {
  text: string;
  startInLine: number;
  endInLine: number;
  kind: AtomicUnitKind;
}

/**
 * Splits a very long unpunctuated or under-punctuated text span near clause punctuation
 * or whitespace to ensure no single atomic unit exceeds the safety threshold.
 */
function splitLongSpanFallback(
  text: string,
  startInLine: number,
  maxLen = MAX_ATOMIC_UNIT_LENGTH
): CandidateSpan[] {
  const spans: CandidateSpan[] = [];
  let currentOffset = 0;

  while (currentOffset < text.length) {
    const remaining = text.length - currentOffset;
    if (remaining <= maxLen) {
      const slice = text.slice(currentOffset);
      const trimmed = slice.trim();
      if (trimmed.length > 0) {
        const lead = slice.indexOf(trimmed);
        const start = startInLine + currentOffset + lead;
        spans.push({
          text: trimmed,
          startInLine: start,
          endInLine: start + trimmed.length,
          kind: "clause-fallback",
        });
      }
      break;
    }

    // Look for punctuation boundaries in the window [maxLen * 0.5, maxLen]
    const windowStart = currentOffset + Math.floor(maxLen * 0.4);
    const windowEnd = currentOffset + maxLen;
    const windowText = text.slice(windowStart, windowEnd);

    // Prefer semicolon, colon, em dash, comma followed by space
    let splitPos = -1;
    let fallbackKind: AtomicUnitKind = "clause-fallback";

    const punctMatch = windowText.search(/[;:\u2014,]\s/);
    if (punctMatch !== -1) {
      splitPos = windowStart + punctMatch + 1; // split after the punctuation
    } else {
      // Fallback to whitespace
      const lastSpace = windowText.lastIndexOf(" ");
      if (lastSpace !== -1) {
        splitPos = windowStart + lastSpace;
        fallbackKind = "length-fallback";
      } else {
        // Hard boundary fallback
        splitPos = windowEnd;
        fallbackKind = "length-fallback";
      }
    }

    const chunk = text.slice(currentOffset, splitPos);
    const trimmedChunk = chunk.trim();
    if (trimmedChunk.length > 0) {
      const lead = chunk.indexOf(trimmedChunk);
      const start = startInLine + currentOffset + lead;
      spans.push({
        text: trimmedChunk,
        startInLine: start,
        endInLine: start + trimmedChunk.length,
        kind: fallbackKind,
      });
    }

    currentOffset = splitPos;
    // Skip any leading whitespace for next iteration
    while (currentOffset < text.length && /\s/.test(text[currentOffset])) {
      currentOffset++;
    }
  }

  return spans;
}

interface IntlSegmentItem {
  segment: string;
  index: number;
  input: string;
}

/**
 * Segments a physical line into candidate atomic units using Intl.Segmenter
 * with fallback for long unpunctuated chunks.
 */
function segmentLineIntoCandidates(
  lineText: string,
  locale = "fr"
): CandidateSpan[] {
  const trimmedLine = lineText.trim();
  if (trimmedLine.length === 0) return [];

  const candidates: CandidateSpan[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intlAny = Intl as any;
  if (typeof intlAny !== "undefined" && typeof intlAny.Segmenter === "function") {
    try {
      const segmenter = new intlAny.Segmenter(locale, { granularity: "sentence" });
      const rawSegments = Array.from(segmenter.segment(lineText)) as IntlSegmentItem[];

      const validRaw = rawSegments.filter((s) => s.segment.trim().length > 0);
      const isSingleLinePoem =
        validRaw.length === 1 &&
        !/[.!?…]$/.test(trimmedLine) &&
        trimmedLine.length < 200;

      for (const item of validRaw) {
        const segText = item.segment;
        const trimmed = segText.trim();
        const lead = segText.indexOf(trimmed);
        const startInLine = item.index + lead;

        if (trimmed.length > MAX_ATOMIC_UNIT_LENGTH) {
          candidates.push(...splitLongSpanFallback(trimmed, startInLine));
        } else {
          candidates.push({
            text: trimmed,
            startInLine,
            endInLine: startInLine + trimmed.length,
            kind: isSingleLinePoem ? "poetic-line" : "sentence",
          });
        }
      }

      if (candidates.length > 0) {
        return candidates;
      }
    } catch {
      // Fall through to regex-based segmentation
    }
  }

  // Fallback sentence segmentation when Intl.Segmenter is unavailable
  const sentenceRegex = /[^.!?…\r\n]+(?:[.!?…]+|$)/g;
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(lineText)) !== null) {
    const rawMatch = match[0];
    const trimmed = rawMatch.trim();
    if (!trimmed) continue;

    const lead = rawMatch.indexOf(trimmed);
    const startInLine = match.index + lead;

    if (trimmed.length > MAX_ATOMIC_UNIT_LENGTH) {
      candidates.push(...splitLongSpanFallback(trimmed, startInLine));
    } else {
      const isPoetic = !/[.!?…]$/.test(trimmed) && trimmed.length < 200;
      candidates.push({
        text: trimmed,
        startInLine,
        endInLine: startInLine + trimmed.length,
        kind: isPoetic ? "poetic-line" : "sentence",
      });
    }
  }

  return candidates;
}

/**
 * Deterministically unitizes raw text into stable atomic units while preserving
 * authorial paragraph/stanza and physical line structure.
 *
 * Invariants:
 * - Author formatting (paragraphs/stanzas, physical lines) is strictly preserved.
 * - Non-empty physical lines are segmented into atomic units (sentences or poetic lines).
 * - Single-line prose pastes with multiple sentences produce multiple atomic units.
 * - Blank lines delineate paragraphs/stanzas.
 * - Offsets match JS/UTF-16 code unit indexing for textarea.setSelectionRange.
 * - Units are ordered, contiguous, non-overlapping, and completely cover all non-whitespace source text.
 */
export function unitizeText(source: string, locale = "fr"): UnitizationResult {
  if (!source) {
    return {
      source: "",
      units: [],
      paragraphs: [],
      lines: [],
      totalLines: 0,
      stanzaCount: 0,
    };
  }

  const units: SourceUnit[] = [];
  const lines: SourceLine[] = [];
  const paragraphs: SourceParagraph[] = [];

  let offset = 0;
  let lineIndex = 0;
  let paragraphIndex = -1;
  let currentlyInParagraph = false;

  const length = source.length;

  while (offset < length) {
    const lineStart = offset;

    // Scan until newline or end of text
    while (offset < length && source[offset] !== "\r" && source[offset] !== "\n") {
      offset++;
    }

    const lineEnd = offset;
    const rawLine = source.slice(lineStart, lineEnd);
    const isBlank = rawLine.trim().length === 0;

    // Advance past CRLF or LF or CR
    if (offset < length && source[offset] === "\r") {
      offset++;
    }
    if (offset < length && source[offset] === "\n") {
      offset++;
    }

    if (!isBlank) {
      if (!currentlyInParagraph) {
        paragraphIndex++;
        currentlyInParagraph = true;
        const paraId = formatParagraphId(paragraphIndex);
        paragraphs.push({
          id: paraId,
          index: paragraphIndex,
          startOffset: lineStart,
          endOffset: lineEnd,
          lineIds: [],
        });
      } else {
        // Expand current paragraph end offset
        paragraphs[paragraphIndex].endOffset = lineEnd;
      }
    } else {
      currentlyInParagraph = false;
    }

    const currentParaId =
      paragraphIndex >= 0 ? formatParagraphId(paragraphIndex) : formatParagraphId(0);
    const lineId = formatLineId(lineIndex);

    lines.push({
      id: lineId,
      paragraphId: currentParaId,
      index: lineIndex,
      startOffset: lineStart,
      endOffset: lineEnd,
      text: rawLine,
      isBlank,
    });

    if (!isBlank) {
      paragraphs[paragraphIndex].lineIds.push(lineId);

      // Segment the line into candidate atomic units
      const candidates = segmentLineIntoCandidates(rawLine, locale);

      for (const cand of candidates) {
        const exactStart = lineStart + cand.startInLine;
        const exactEnd = exactStart + cand.text.length;

        units.push({
          id: formatUnitId(units.length),
          index: units.length,
          text: cand.text,
          lineIndex,
          stanzaIndex: paragraphIndex,
          paragraphId: currentParaId,
          lineId,
          kind: cand.kind,
          startIndex: exactStart,
          endIndex: exactEnd,
        });
      }
    }

    lineIndex++;
  }

  return {
    source,
    units,
    paragraphs,
    lines,
    totalLines: lineIndex,
    stanzaCount: paragraphs.length,
  };
}

/** Formats the prepared atomic units with paragraph markers into the model payload text. */
export function formatModelPayload(result: UnitizationResult): string {
  const parts: string[] = [];

  for (const para of result.paragraphs) {
    parts.push(`[${para.id.toUpperCase()}]`);
    const paraUnits = result.units.filter((u) => u.paragraphId === para.id);
    for (const unit of paraUnits) {
      parts.push(`[${unit.id}] ${unit.text}`);
    }
    parts.push(`[/${para.id.toUpperCase()}]`);
  }

  return parts.join("\n");
}

/**
 * Resolves a model-returned segment's start and end unit IDs into exact UTF-16 offsets
 * and line boundaries from local source units.
 */
export function resolveSegmentOffsets(
  segment: {
    startUnitId?: string;
    endUnitId?: string;
    start_unit_id?: string;
    end_unit_id?: string;
  },
  units: SourceUnit[]
): {
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
} | null {
  const startId = segment.startUnitId ?? segment.start_unit_id;
  const endId = segment.endUnitId ?? segment.end_unit_id;
  if (!startId || !endId) return null;

  const startUnit = units.find((u) => u.id === startId);
  const endUnit = units.find((u) => u.id === endId);

  if (!startUnit || !endUnit) return null;

  return {
    startOffset: startUnit.startIndex,
    endOffset: endUnit.endIndex,
    startLine: startUnit.lineIndex + 1,
    endLine: endUnit.lineIndex + 1,
  };
}
