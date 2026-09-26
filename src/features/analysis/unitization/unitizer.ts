export interface SourceUnit {
  /** Stable identifier formatted as u0001, u0002, etc. */
  id: string;
  /** Sequential zero-based index of the non-empty unit */
  index: number;
  /** Exact trimmed text content of the unit for model consumption */
  text: string;
  /** Physical zero-based line index in the source text */
  lineIndex: number;
  /** Zero-based stanza index grouping contiguous non-empty lines */
  stanzaIndex: number;
  /** UTF-16 start offset in original source for textarea.setSelectionRange */
  startIndex: number;
  /** UTF-16 end offset in original source for textarea.setSelectionRange */
  endIndex: number;
}

export interface UnitizationResult {
  /** Original untampered source text */
  source: string;
  /** Ordered list of non-empty units */
  units: SourceUnit[];
  /** Total physical line count */
  totalLines: number;
  /** Total detected stanzas */
  stanzaCount: number;
}

/**
 * Formats a zero-based unit index into a stable unit ID (e.g., u0001).
 */
export function formatUnitId(unitIndex: number): string {
  const numberPart = (unitIndex + 1).toString().padStart(4, "0");
  return `u${numberPart}`;
}

/**
 * Deterministically unitizes raw text into stable line-based units.
 *
 * Requirements:
 * - Preserves original source exactly without arbitrary truncation.
 * - Non-empty lines form atomic source units with stable IDs (u0001, etc.).
 * - Blank lines delineate stanzas.
 * - Offsets match JS/UTF-16 code unit indexing for textarea.setSelectionRange().
 */
export function unitizeText(source: string): UnitizationResult {
  const units: SourceUnit[] = [];

  if (!source) {
    return {
      source: "",
      units: [],
      totalLines: 0,
      stanzaCount: 0,
    };
  }

  // Iterate through lines while tracking exact UTF-16 offsets
  let offset = 0;
  let lineIndex = 0;
  let stanzaIndex = 0;
  let inStanza = false;

  const length = source.length;

  while (offset < length) {
    const lineStart = offset;

    // Scan until newline or end of text
    while (offset < length && source[offset] !== "\r" && source[offset] !== "\n") {
      offset++;
    }

    const lineEnd = offset;
    const rawLine = source.slice(lineStart, lineEnd);
    const trimmedLine = rawLine.trim();

    if (trimmedLine.length > 0) {
      if (!inStanza && lineIndex > 0) {
        stanzaIndex++;
      }
      inStanza = true;

      // Find start and end within rawLine for exact trimmed bounds
      const leadOffset = rawLine.indexOf(trimmedLine);
      const exactStart = lineStart + leadOffset;
      const exactEnd = exactStart + trimmedLine.length;

      units.push({
        id: formatUnitId(units.length),
        index: units.length,
        text: trimmedLine,
        lineIndex,
        stanzaIndex,
        startIndex: exactStart,
        endIndex: exactEnd,
      });
    } else {
      inStanza = false;
    }

    // Skip newline sequence (\r\n or \n or \r)
    if (offset < length && source[offset] === "\r") {
      offset++;
    }
    if (offset < length && source[offset] === "\n") {
      offset++;
    }

    lineIndex++;
  }

  const stanzaCount = units.length > 0 ? stanzaIndex + 1 : 0;

  return {
    source,
    units,
    totalLines: lineIndex,
    stanzaCount,
  };
}

/**
 * Computes the selection range [start, end] for a span of unit IDs.
 */
export function getUnitSpanSelection(
  units: SourceUnit[],
  startUnitId: string,
  endUnitId: string
): { start: number; end: number } | null {
  const startUnit = units.find((u) => u.id === startUnitId);
  const endUnit = units.find((u) => u.id === endUnitId);

  if (!startUnit || !endUnit) {
    return null;
  }

  const start = Math.min(startUnit.startIndex, endUnit.startIndex);
  const end = Math.max(startUnit.endIndex, endUnit.endIndex);

  return { start, end };
}
