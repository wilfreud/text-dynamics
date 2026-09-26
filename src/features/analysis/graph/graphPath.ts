import type { MovementKind } from "../types";

export interface PathPoint {
  x: number;
  y: number;
}

/**
 * Generates an SVG path segment command ('C ...' or 'L ...') between two consecutive points
 * faithfully reflecting movement semantics without generic oversmoothing.
 */
export function generateSemanticPathSegment(
  p1: PathPoint,
  p2: PathPoint,
  kind?: MovementKind | "linear"
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // If points are coincident, no movement needed
  if (Math.abs(dx) < 0.001) {
    return `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  switch (kind) {
    case "drop": {
      // Near-vertical / abrupt drop: sustains level then plunges steeply
      const dropThresholdX = p1.x + dx * 0.82;
      return `L ${dropThresholdX.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    case "spike": {
      // Steep ascent or descent: rapid early transition
      const spikeX = p1.x + dx * 0.25;
      return `L ${spikeX.toFixed(2)} ${p2.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    case "plateau": {
      // Visually flat hold across span, crisp step at the boundary
      const plateauEndX = p1.x + dx * 0.88;
      return `L ${plateauEndX.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    case "crescendo":
    case "decrescendo": {
      // Progressive progressive interpolation via smooth cubic S-curve
      const cp1x = p1.x + dx * 0.42;
      const cp1y = p1.y;
      const cp2x = p1.x + dx * 0.58;
      const cp2y = p2.y;
      return `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    case "rupture":
    case "reset": {
      // Structural break: crisp orthogonal step
      const stepX = p1.x + dx * 0.5;
      return `L ${stepX.toFixed(2)} ${p1.y.toFixed(2)} L ${stepX.toFixed(2)} ${p2.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    case "reversal": {
      // Angular inflection
      const midX = p1.x + dx * 0.5;
      const midY = p1.y + dy * 0.15;
      return `L ${midX.toFixed(2)} ${midY.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    case "sustain": {
      // Level sustain until final step
      return `L ${p2.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    case "oscillation": {
      // Gentle undulation across the interval
      const q1x = p1.x + dx * 0.25;
      const q1y = p1.y + dy * 0.25 - 8;
      const midX = p1.x + dx * 0.5;
      const midY = p1.y + dy * 0.5;
      const q2x = p1.x + dx * 0.75;
      const q2y = p1.y + dy * 0.75 + 8;
      return `Q ${q1x.toFixed(2)} ${q1y.toFixed(2)}, ${midX.toFixed(2)} ${midY.toFixed(2)} Q ${q2x.toFixed(2)} ${q2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    case "linear":
    default: {
      // Default honest straight connection
      return `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
  }
}
