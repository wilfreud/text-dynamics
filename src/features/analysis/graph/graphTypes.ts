import type { MovementKind, SegmentMetrics } from "../types";

export interface GraphPoint {
  segmentId: string;
  x: number;
  y: number;
  metrics: SegmentMetrics;
  isOverridden: boolean;
}

export interface GraphMovementSpan {
  movementId: string;
  kind: MovementKind;
  startIndex: number;
  endIndex: number;
}

export interface GraphViewport {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}
