import type { SourceUnit } from "../unitization/unitizer";
import type { CanonicalAnalysis, UserOverrides } from "../types";
import {
  METRIC_DESCRIPTORS,
  type GraphGrid,
  type GraphMovementMarker,
  type GraphPathSegment,
  type GraphPhaseBand,
  type GraphPoint,
  type GraphViewModel,
  type GraphViewportConfig,
  type MetricKind,
} from "./graphTypes";
import { projectEffectiveAnalysis } from "./effectiveAnalysis";
import { computeGraphGrid, projectX, projectY } from "./graphGeometry";
import { generateSemanticPathSegment } from "./graphPath";

export function buildGraphViewModel(
  canonical: CanonicalAnalysis,
  overrides: UserOverrides | undefined,
  sourceUnits: SourceUnit[],
  metricKind: MetricKind,
  viewport: GraphViewportConfig
): GraphViewModel {
  const descriptor = METRIC_DESCRIPTORS[metricKind];
  const { segments: effectiveSegments, movements: effectiveMovements } =
    projectEffectiveAnalysis(canonical, overrides);

  const totalPoints = effectiveSegments.length;

  // 1. Build ordered graph points
  const points: GraphPoint[] = effectiveSegments.map((seg, i) => {
    const x = projectX(i, totalPoints, viewport);
    const metricVal = seg.metrics[metricKind];
    const y = projectY(metricVal, descriptor, viewport);

    const startUnit = sourceUnits.find((u) => u.id === seg.startUnitId);
    const endUnit = sourceUnits.find((u) => u.id === seg.endUnitId);

    const startLine = (startUnit?.lineIndex ?? 0) + 1;
    const endLine = (endUnit?.lineIndex ?? startUnit?.lineIndex ?? 0) + 1;
    const lineRangeLabel =
      startLine === endLine
        ? `Line ${startLine}`
        : `Lines ${startLine}–${endLine}`;

    // Derive concise excerpt from local source units, never model-invented
    let excerpt = "";
    if (startUnit) {
      if (startUnit.id === endUnit?.id || !endUnit) {
        excerpt = startUnit.text;
      } else {
        excerpt = `${startUnit.text} … ${endUnit.text}`;
      }
    }
    if (excerpt.length > 80) {
      excerpt = `${excerpt.slice(0, 77)}...`;
    }

    // Find phase association
    const phase = canonical.phases.find((p) => {
      const segIds = canonical.segments.map((s) => s.id);
      const startIdx = segIds.indexOf(p.startSegmentId);
      const endIdx = segIds.indexOf(p.endSegmentId);
      return i >= startIdx && i <= endIdx;
    });

    // Find movement association
    const movement = effectiveMovements.find((m) => {
      const segIds = canonical.segments.map((s) => s.id);
      const startIdx = segIds.indexOf(m.startSegmentId);
      const endIdx = segIds.indexOf(m.endSegmentId);
      return i >= startIdx && i <= endIdx;
    });

    return {
      segmentId: seg.id,
      index: i,
      x,
      y,
      effectiveValue: metricVal,
      metrics: seg.metrics,
      isOverridden: seg.isOverridden[metricKind],
      startLine,
      endLine,
      lineRangeLabel,
      excerpt,
      phaseLabel: phase?.label,
      movementKind: movement?.kind,
    };
  });

  // 2. Build connecting semantic path segments between adjacent points
  const paths: GraphPathSegment[] = [];
  const segIds = effectiveSegments.map((s) => s.id);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Find if any movement spans this edge
    const movement = effectiveMovements.find((m) => {
      const sIdx = segIds.indexOf(m.startSegmentId);
      const eIdx = segIds.indexOf(m.endSegmentId);
      return sIdx <= i && eIdx >= i + 1;
    });

    const kind = movement ? movement.kind : "linear";
    const isRupture = kind === "rupture" || kind === "reset";
    const segmentCmd = generateSemanticPathSegment(
      { x: p1.x, y: p1.y },
      { x: p2.x, y: p2.y },
      kind
    );
    const d = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${segmentCmd}`;

    paths.push({
      id: `path_${p1.segmentId}_${p2.segmentId}`,
      d,
      fromSegmentId: p1.segmentId,
      toSegmentId: p2.segmentId,
      movementKind: kind,
      isRupture,
    });
  }

  // 3. Build phase background bands
  const phaseBands: GraphPhaseBand[] = [];
  for (const phase of canonical.phases) {
    const sIdx = segIds.indexOf(phase.startSegmentId);
    const eIdx = segIds.indexOf(phase.endSegmentId);
    if (sIdx === -1 || eIdx === -1) continue;

    const pStart = points[Math.min(sIdx, eIdx)];
    const pEnd = points[Math.max(sIdx, eIdx)];

    const halfStep =
      points.length > 1 ? (points[1].x - points[0].x) / 2 : 20;

    const x = Math.max(viewport.padding.left, pStart.x - halfStep);
    const rightX = Math.min(
      viewport.width - viewport.padding.right,
      pEnd.x + halfStep
    );
    const width = Math.max(4, rightX - x);

    phaseBands.push({
      id: phase.id,
      kind: phase.kind,
      label: phase.label,
      x,
      width,
      confidence: phase.confidence,
    });
  }

  // 4. Build movement markers (at top gutter)
  const markerY = Math.max(16, viewport.padding.top - 18);
  const movementMarkers: GraphMovementMarker[] = [];
  for (const mov of effectiveMovements) {
    const sIdx = segIds.indexOf(mov.startSegmentId);
    const eIdx = segIds.indexOf(mov.endSegmentId);
    if (sIdx === -1 || eIdx === -1) continue;

    const pStart = points[Math.min(sIdx, eIdx)];
    const pEnd = points[Math.max(sIdx, eIdx)];

    movementMarkers.push({
      id: mov.id,
      kind: mov.kind,
      magnitude: mov.magnitude,
      confidence: mov.confidence,
      rationale: mov.rationale,
      xStart: pStart.x,
      xEnd: pEnd.x,
      y: markerY,
    });
  }

  // 5. Build grid and neutral baseline
  const grid: GraphGrid = computeGraphGrid(descriptor, viewport);

  return {
    metric: descriptor,
    viewport,
    points,
    paths,
    phaseBands,
    movementMarkers,
    grid,
  };
}
