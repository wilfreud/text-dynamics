import type { GraphGrid, GraphViewportConfig, MetricDescriptor } from "./graphTypes";

export const DEFAULT_VIEWPORT_PADDING = {
  top: 48,
  right: 40,
  bottom: 52,
  left: 48,
};

/**
 * Maps a discrete point index in the sequence to a continuous X coordinate in SVG pixels.
 */
export function projectX(
  index: number,
  totalPoints: number,
  viewport: GraphViewportConfig
): number {
  const plotWidth = Math.max(
    10,
    viewport.width - viewport.padding.left - viewport.padding.right
  );

  if (totalPoints <= 1) {
    return viewport.padding.left + plotWidth / 2;
  }

  const step = plotWidth / (totalPoints - 1);
  return viewport.padding.left + index * step;
}

/**
 * Maps a metric value (bounded by descriptor min/max) to a continuous Y coordinate in SVG pixels.
 * Inverts coordinates so higher values appear higher on the screen (smaller Y in SVG).
 */
export function projectY(
  value: number,
  descriptor: MetricDescriptor,
  viewport: GraphViewportConfig
): number {
  const plotHeight = Math.max(
    10,
    viewport.height - viewport.padding.top - viewport.padding.bottom
  );

  const range = descriptor.max - descriptor.min;
  if (range <= 0) {
    return viewport.padding.top + plotHeight / 2;
  }

  const normalized = (value - descriptor.min) / range;
  const clampedNorm = Math.min(Math.max(normalized, 0), 1);

  return viewport.padding.top + (1 - clampedNorm) * plotHeight;
}

/**
 * Inverts an SVG Y coordinate back to the metric value domain.
 * Useful for drag interactions in Task 07.
 */
export function unprojectY(
  pixelY: number,
  descriptor: MetricDescriptor,
  viewport: GraphViewportConfig
): number {
  const plotHeight = Math.max(
    10,
    viewport.height - viewport.padding.top - viewport.padding.bottom
  );
  if (plotHeight <= 0) return descriptor.baseline;

  const relY = pixelY - viewport.padding.top;
  const clampedRelY = Math.min(Math.max(relY, 0), plotHeight);
  const normalized = 1 - clampedRelY / plotHeight;

  const value = descriptor.min + normalized * (descriptor.max - descriptor.min);
  return Math.round(value * 10) / 10;
}

/**
 * Computes axis ticks and neutral baseline position.
 */
export function computeGraphGrid(
  descriptor: MetricDescriptor,
  viewport: GraphViewportConfig
): GraphGrid {
  const rawValues =
    descriptor.min < 0
      ? [-10, -5, 0, 5, 10]
      : [0, 2.5, 5, 7.5, 10];

  const ticks = rawValues.map((val) => {
    const y = projectY(val, descriptor, viewport);
    const label = val > 0 && descriptor.min < 0 ? `+${val}` : `${val}`;
    return { value: val, y, label };
  });

  const baselineY = descriptor.hasBaseline
    ? projectY(descriptor.baseline, descriptor, viewport)
    : null;

  return { ticks, baselineY };
}
