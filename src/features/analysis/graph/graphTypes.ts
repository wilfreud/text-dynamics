import type { MovementKind, PhaseKind, SegmentMetrics } from "../types";

export type MetricKind = "intensity" | "tension" | "valence" | "temperature";

export type CurveInterpolation = "smooth" | "linear";

export interface MetricDescriptor {
  kind: MetricKind;
  label: string;
  min: number;
  max: number;
  hasBaseline: boolean;
  baseline: number;
  description: string;
}

export const METRIC_DESCRIPTORS: Record<MetricKind, MetricDescriptor> = {
  intensity: {
    kind: "intensity",
    label: "Intensity",
    min: 0,
    max: 10,
    hasBaseline: false,
    baseline: 0,
    description: "Perceived force, impact, acoustic weight, or visceral energy (0 to 10).",
  },
  tension: {
    kind: "tension",
    label: "Tension",
    min: 0,
    max: 10,
    hasBaseline: false,
    baseline: 0,
    description: "Psychological suspense, pressure, unresolved expectancy, or structural friction (0 to 10).",
  },
  valence: {
    kind: "valence",
    label: "Valence",
    min: -10,
    max: 10,
    hasBaseline: true,
    baseline: 0,
    description: "Affective direction from dark/negative (-10) to bright/positive (+10) around neutral (0).",
  },
  temperature: {
    kind: "temperature",
    label: "Temperature",
    min: -10,
    max: 10,
    hasBaseline: true,
    baseline: 0,
    description: "Affective register from detached/cold (-10) to passionate/hot (+10) around neutral (0).",
  },
};

export interface EffectiveSegment {
  id: string;
  startUnitId: string;
  endUnitId: string;
  metrics: SegmentMetrics;
  isOverridden: {
    intensity: boolean;
    tension: boolean;
    valence: boolean;
    temperature: boolean;
  };
  hasAnyOverride: boolean;
  rationale?: string;
}

export interface EffectiveMovement {
  id: string;
  startSegmentId: string;
  endSegmentId: string;
  kind: MovementKind;
  magnitude: number;
  confidence: number;
  rationale?: string;
  isOverridden: boolean;
}

export interface GraphViewportConfig {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface GraphPoint {
  segmentId: string;
  index: number;
  totalSegments: number;
  x: number;
  y: number;
  effectiveValue: number;
  metrics: SegmentMetrics;
  isOverridden: boolean;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  startUnitId: string;
  endUnitId: string;
  lineRangeLabel: string;
  excerpt: string;
  sourcePassage: string;
  rationale?: string;
  phaseLabel?: string;
  movementKind?: MovementKind;
}

export interface GraphPathSegment {
  id: string;
  d: string;
  fromSegmentId: string;
  toSegmentId: string;
  movementKind: MovementKind | "linear";
  isRupture: boolean;
}

export interface GraphPhaseBand {
  id: string;
  kind: PhaseKind;
  label: string;
  x: number;
  width: number;
  confidence: number;
}

export interface GraphMovementMarker {
  id: string;
  kind: MovementKind;
  magnitude: number;
  confidence: number;
  rationale?: string;
  xStart: number;
  xEnd: number;
  y: number;
}

export interface GraphGrid {
  ticks: Array<{ value: number; y: number; label: string }>;
  baselineY: number | null;
}

export interface GraphViewModel {
  metric: MetricDescriptor;
  viewport: GraphViewportConfig;
  points: GraphPoint[];
  paths: GraphPathSegment[];
  phaseBands: GraphPhaseBand[];
  movementMarkers: GraphMovementMarker[];
  grid: GraphGrid;
}
