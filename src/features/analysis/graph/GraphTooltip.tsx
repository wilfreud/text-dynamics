import type { GraphMovementMarker, GraphPoint, MetricDescriptor } from "./graphTypes";

export type TooltipTarget =
  | { type: "point"; point: GraphPoint }
  | { type: "movement"; marker: GraphMovementMarker };

interface GraphTooltipProps {
  target: TooltipTarget | null;
  metric: MetricDescriptor;
  containerWidth: number;
  containerHeight: number;
}

export function GraphTooltip({
  target,
  metric,
  containerWidth,
  containerHeight,
}: GraphTooltipProps) {
  if (!target) return null;

  let x = 0;
  let y = 0;

  if (target.type === "point") {
    x = target.point.x;
    y = target.point.y;
  } else {
    x = (target.marker.xStart + target.marker.xEnd) / 2;
    y = target.marker.y;
  }

  // Position tooltip above point by default, flip if near top
  const tooltipWidth = 260;
  const tooltipHeight = target.type === "point" ? 170 : 100;

  let left = x - tooltipWidth / 2;
  if (left < 16) left = 16;
  if (left + tooltipWidth > containerWidth - 16) {
    left = containerWidth - tooltipWidth - 16;
  }

  let top = y - tooltipHeight - 14;
  if (top < 12) {
    // Flip below
    top = y + 16;
  }
  if (top + tooltipHeight > containerHeight - 12) {
    top = Math.max(12, containerHeight - tooltipHeight - 12);
  }

  return (
    <div
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${tooltipWidth}px`,
      }}
      className="pointer-events-none absolute z-30 select-none rounded-lg border border-border/80 bg-popover/95 p-3 font-sans text-xs text-popover-foreground shadow-lg backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100"
    >
      {target.type === "point" && (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 pb-1.5 font-mono text-[11px]">
            <span className="font-semibold text-foreground">
              {target.point.lineRangeLabel}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{target.point.segmentId}</span>
              {target.point.isOverridden && (
                <span className="rounded bg-muted px-1 text-[10px] font-medium text-foreground">
                  User
                </span>
              )}
            </div>
          </div>

          {/* Local Excerpt */}
          {target.point.excerpt && (
            <p className="line-clamp-2 italic text-muted-foreground leading-snug">
              "{target.point.excerpt}"
            </p>
          )}

          {/* Primary Metric */}
          <div className="flex items-baseline justify-between border-t border-border/40 pt-1.5 font-mono">
            <span className="text-[11px] text-muted-foreground font-medium">
              {metric.label}:
            </span>
            <span className="text-sm font-bold text-foreground">
              {target.point.effectiveValue > 0 && metric.hasBaseline
                ? `+${target.point.effectiveValue}`
                : target.point.effectiveValue}
            </span>
          </div>

          {/* Secondary Metrics Breakdown */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-border/30 pt-1 font-mono text-[10px] text-muted-foreground">
            <div>Int: {target.point.metrics.intensity}</div>
            <div>Ten: {target.point.metrics.tension}</div>
            <div>
              Val:{" "}
              {target.point.metrics.valence > 0
                ? `+${target.point.metrics.valence}`
                : target.point.metrics.valence}
            </div>
            <div>
              Temp:{" "}
              {target.point.metrics.temperature > 0
                ? `+${target.point.metrics.temperature}`
                : target.point.metrics.temperature}
            </div>
            <div className="col-span-2 pt-0.5 text-muted-foreground/80">
              Confidence: {Math.round(target.point.metrics.confidence * 100)}%
            </div>
          </div>

          {/* Context Footer (Movement/Phase) */}
          {(target.point.movementKind || target.point.phaseLabel) && (
            <div className="flex items-center justify-between border-t border-border/30 pt-1 font-mono text-[10px] text-muted-foreground">
              {target.point.phaseLabel && (
                <span className="truncate">Phase: {target.point.phaseLabel}</span>
              )}
              {target.point.movementKind && (
                <span className="font-semibold uppercase text-foreground">
                  {target.point.movementKind}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {target.type === "movement" && (
        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between border-b border-border/50 pb-1">
            <span className="font-bold uppercase text-foreground">
              {target.marker.kind}
            </span>
            <span className="text-[10px] text-muted-foreground">
              mag: {target.marker.magnitude}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Confidence: {Math.round(target.marker.confidence * 100)}%
          </div>
          {target.marker.rationale && (
            <p className="line-clamp-2 font-sans text-xs italic text-muted-foreground">
              "{target.marker.rationale}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
