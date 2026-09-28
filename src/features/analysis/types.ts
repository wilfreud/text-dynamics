export type MovementKind =
  | "crescendo"
  | "decrescendo"
  | "spike"
  | "drop"
  | "plateau"
  | "oscillation"
  | "rupture"
  | "reversal"
  | "reset"
  | "sustain";

export type PhaseKind =
  | "build_up"
  | "climax"
  | "break"
  | "aftermath"
  | "plateau"
  | "oscillation"
  | "other";

export interface SegmentMetrics {
  intensity: number; // 0..10
  tension: number; // 0..10
  valence: number; // -10..10
  temperature: number; // -10..10
  confidence: number; // 0..1
  rationale?: string;
}

export interface AnalysisSegment extends SegmentMetrics {
  id: string;
  startUnitId: string;
  endUnitId: string;
}

export interface AnalysisMovement {
  id: string;
  startSegmentId: string;
  endSegmentId: string;
  kind: MovementKind;
  magnitude: number;
  confidence: number;
  rationale?: string;
}

export interface AnalysisPhase {
  id: string;
  startSegmentId: string;
  endSegmentId: string;
  kind: PhaseKind;
  label: string;
  confidence: number;
}

export interface AnalysisOverall {
  summary: string;
  dominantShape: string;
}

export interface CanonicalAnalysis {
  schemaVersion: string;
  segments: AnalysisSegment[];
  movements: AnalysisMovement[];
  phases: AnalysisPhase[];
  overall: AnalysisOverall;
}

export interface SegmentOverride {
  intensity?: number;
  tension?: number;
  valence?: number;
  temperature?: number;
}

export interface MovementOverride {
  kind?: MovementKind;
}

export interface SegmentGroup {
  id: string;
  label: string;
  segmentIds: string[];
}

export interface UserOverrides {
  segmentOverrides: Record<string, SegmentOverride>;
  movementOverrides: Record<string, MovementOverride>;
  groups: SegmentGroup[];
}

export interface AnalysisRetryState {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  remainingMs: number;
  statusCode?: number;
  message: string;
  isWaiting: boolean;
}
