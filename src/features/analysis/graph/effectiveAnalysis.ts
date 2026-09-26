import type {
  CanonicalAnalysis,
  UserOverrides,
} from "../types";
import type {
  EffectiveSegment,
  EffectiveMovement,
} from "./graphTypes";

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Projects a canonical AI analysis merged with user overrides into effective layers.
 * Invariant: Never mutates the base canonical analysis or the user overrides objects.
 */
export function projectEffectiveAnalysis(
  canonical: CanonicalAnalysis,
  overrides?: UserOverrides
): {
  segments: EffectiveSegment[];
  movements: EffectiveMovement[];
} {
  const segOverrides = overrides?.segmentOverrides ?? {};
  const movOverrides = overrides?.movementOverrides ?? {};

  const effectiveSegments: EffectiveSegment[] = canonical.segments.map((base) => {
    const override = segOverrides[base.id];

    const hasIntensityOverride = override?.intensity !== undefined;
    const hasTensionOverride = override?.tension !== undefined;
    const hasValenceOverride = override?.valence !== undefined;
    const hasTemperatureOverride = override?.temperature !== undefined;

    const intensity = clamp(
      hasIntensityOverride ? override.intensity! : base.intensity,
      0,
      10
    );
    const tension = clamp(
      hasTensionOverride ? override.tension! : base.tension,
      0,
      10
    );
    const valence = clamp(
      hasValenceOverride ? override.valence! : base.valence,
      -10,
      10
    );
    const temperature = clamp(
      hasTemperatureOverride ? override.temperature! : base.temperature,
      -10,
      10
    );

    const hasAnyOverride =
      hasIntensityOverride ||
      hasTensionOverride ||
      hasValenceOverride ||
      hasTemperatureOverride;

    return {
      id: base.id,
      startUnitId: base.startUnitId,
      endUnitId: base.endUnitId,
      metrics: {
        intensity,
        tension,
        valence,
        temperature,
        confidence: base.confidence,
        rationale: base.rationale,
      },
      isOverridden: {
        intensity: hasIntensityOverride,
        tension: hasTensionOverride,
        valence: hasValenceOverride,
        temperature: hasTemperatureOverride,
      },
      hasAnyOverride,
      rationale: base.rationale,
    };
  });

  const effectiveMovements: EffectiveMovement[] = canonical.movements.map((base) => {
    const override = movOverrides[base.id];
    const isOverridden = override?.kind !== undefined;
    const kind = isOverridden ? override.kind! : base.kind;

    return {
      id: base.id,
      startSegmentId: base.startSegmentId,
      endSegmentId: base.endSegmentId,
      kind,
      magnitude: base.magnitude,
      confidence: base.confidence,
      rationale: base.rationale,
      isOverridden,
    };
  });

  return {
    segments: effectiveSegments,
    movements: effectiveMovements,
  };
}
