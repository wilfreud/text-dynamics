import type { MovementKind } from "../types";

export interface PathPoint {
  x: number;
  y: number;
}

export interface SplineControlPoints {
  cp1: PathPoint;
  cp2: PathPoint;
}

/**
 * Computes Fritsch-Carlson monotone cubic spline control points for a series of 2D points.
 * Guarantees monotonicity:
 * - No overshoot (extremum values are strictly preserved within point bounds).
 * - Tangents at local peaks and valleys are strictly horizontal (slope = 0).
 * - Boundary discontinuities (e.g. ruptures or resets) isolate tangent calculation so breaks
 *   never leak slopes into adjacent segments.
 */
export function computeMonotoneCubicControlPoints(
  points: PathPoint[],
  isDiscontinuous?: (intervalIndex: number) => boolean
): SplineControlPoints[] {
  const n = points.length;
  if (n < 2) return [];

  if (n === 2) {
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    return [
      {
        cp1: { x: points[0].x + dx / 3, y: points[0].y + dy / 3 },
        cp2: { x: points[1].x - dx / 3, y: points[1].y - dy / 3 },
      },
    ];
  }

  // 1. Calculate secant slopes (deltas) and dx for each interval [0 .. n-2]
  const deltas: number[] = new Array(n - 1);
  const dxs: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs[i] = dx;
    deltas[i] = Math.abs(dx) > 1e-6 ? dy / dx : 0;
  }

  // 2. Initial slopes at vertices m[0 .. n-1]
  const m: number[] = new Array(n);
  m[0] = deltas[0];
  m[n - 1] = deltas[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const prevDiscontinuous = isDiscontinuous?.(i - 1) ?? false;
    const nextDiscontinuous = isDiscontinuous?.(i) ?? false;

    if (prevDiscontinuous && nextDiscontinuous) {
      m[i] = 0;
    } else if (prevDiscontinuous) {
      m[i] = deltas[i];
    } else if (nextDiscontinuous) {
      m[i] = deltas[i - 1];
    } else if (deltas[i - 1] * deltas[i] <= 0) {
      // Local peak or valley: derivative must be 0 to prevent overshoot
      m[i] = 0;
    } else {
      m[i] = (deltas[i - 1] + deltas[i]) / 2;
    }
  }

  // 3. Fritsch-Carlson monotonicity check & scaling for continuous intervals
  for (let i = 0; i < n - 1; i++) {
    if (isDiscontinuous?.(i)) {
      continue;
    }

    if (Math.abs(deltas[i]) < 1e-6) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }

    const alpha = m[i] / deltas[i];
    const beta = m[i + 1] / deltas[i];

    if (alpha < 0) m[i] = 0;
    if (beta < 0) m[i + 1] = 0;

    const hypSq = alpha * alpha + beta * beta;
    if (hypSq > 9) {
      const tau = 3 / Math.sqrt(hypSq);
      m[i] = tau * alpha * deltas[i];
      m[i + 1] = tau * beta * deltas[i];
    }
  }

  // 4. Generate Bézier control points for each interval
  const controlPoints: SplineControlPoints[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = dxs[i];
    controlPoints.push({
      cp1: {
        x: points[i].x + dx / 3,
        y: points[i].y + (m[i] * dx) / 3,
      },
      cp2: {
        x: points[i + 1].x - dx / 3,
        y: points[i + 1].y - (m[i + 1] * dx) / 3,
      },
    });
  }

  return controlPoints;
}

/**
 * Generates an SVG path segment command ('C ...' or 'L ...') between two consecutive points
 * faithfully reflecting movement semantics without generic oversmoothing of drops/ruptures.
 */
export function generateSemanticPathSegment(
  p1: PathPoint,
  p2: PathPoint,
  kind?: MovementKind | "linear",
  controlPoints?: SplineControlPoints
): string {
  const dx = p2.x - p1.x;

  // If points are coincident, no movement needed
  if (Math.abs(dx) < 0.001) {
    return `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  // Structural rupture or reset: always crisp orthogonal step break
  if (kind === "rupture" || kind === "reset") {
    const stepX = p1.x + dx * 0.5;
    return `L ${stepX.toFixed(2)} ${p1.y.toFixed(2)} L ${stepX.toFixed(2)} ${p2.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  // Smooth mode: if monotone cubic spline control points are supplied, render cubic Bezier
  if (controlPoints) {
    return `C ${controlPoints.cp1.x.toFixed(2)} ${controlPoints.cp1.y.toFixed(2)}, ${controlPoints.cp2.x.toFixed(2)} ${controlPoints.cp2.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  // Linear mode: clean direct straight line
  return `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}
