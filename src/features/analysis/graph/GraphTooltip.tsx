import type { GraphMovementMarker, GraphPoint, MetricDescriptor } from "./graphTypes";
import { createPassagePreview } from "../passage/passagePreview";
import { Maximize2 } from "lucide-react";

export type TooltipTarget =
  | { type: "point"; point: GraphPoint }
  | { type: "movement"; marker: GraphMovementMarker };

interface GraphTooltipProps {
  target: TooltipTarget | null;
  metric: MetricDescriptor;
  containerWidth: number;
  containerHeight: number;
  onOpenPassageReader?: (point: GraphPoint) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function GraphTooltip({
  target,
  metric,
  containerWidth,
  containerHeight,
  onOpenPassageReader,
  onMouseEnter,
  onMouseLeave,
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
  const tooltipWidth = 280;
  const tooltipHeight = target.type === "point" ? 220 : 100;

  let left = x - tooltipWidth / 2;
  if (left < 16) left = 16;
  if (left + tooltipWidth > containerWidth - 16) {
    left = containerWidth - tooltipWidth - 16;
  }

  let top = y - tooltipHeight - 16;
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="pointer-events-auto absolute z-30 select-none rounded-lg border border-border/80 bg-popover/95 p-3.5 font-sans text-xs text-popover-foreground shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100"
    >
      {target.type === "point" && (
        <PointTooltipContent
          point={target.point}
          metric={metric}
          onOpenPassageReader={onOpenPassageReader}
        />
      )}

      {target.type === "movement" && (
        <MovementTooltipContent marker={target.marker} />
      )}
    </div>
  );
}

interface PointTooltipContentProps {
  point: GraphPoint;
  metric: MetricDescriptor;
  onOpenPassageReader?: (point: GraphPoint) => void;
}

function PointTooltipContent({
  point,
  metric,
  onOpenPassageReader,
}: PointTooltipContentProps) {
  const preview = createPassagePreview(point.sourcePassage, {
    fullThreshold: 180,
    headTarget: 95,
    tailTarget: 70,
  });

  return (
    <div className="space-y-2">
      {/* Header: Segment ordinal & ID */}
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5 font-mono text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground">
            {point.lineRangeLabel}
          </span>
          {point.isOverridden && (
            <span className="rounded bg-muted px-1 text-[10px] font-medium text-foreground">
              User
            </span>
          )}
        </div>
        <span className="text-muted-foreground">{point.segmentId}</span>
      </div>

      {/* Semantic rationale/label if present */}
      {point.rationale && (
        <div className="text-[11px] italic text-muted-foreground line-clamp-1 leading-snug">
          {point.rationale}
        </div>
      )}

      {/* Source Passage Preview & Expand Action */}
      <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1">
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider font-semibold">Passage</span>
          {onOpenPassageReader && (
            <button
              type="button"
              onClick={() => onOpenPassageReader(point)}
              title="Open full passage reader"
              aria-label="Open full passage reader"
              className="flex items-center gap-1 rounded hover:bg-muted/80 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <Maximize2 className="size-3" />
            </button>
          )}
        </div>

        {preview.kind === "full" ? (
          <p className="whitespace-pre-wrap font-serif text-[11.5px] leading-relaxed text-foreground/90 select-text max-h-16 overflow-hidden">
            {preview.text}
          </p>
        ) : (
          <div className="font-serif text-[11.5px] leading-snug text-foreground/90 whitespace-pre-wrap select-text space-y-0.5">
            <p>{preview.head}…</p>
            <p className="text-[9px] text-muted-foreground/60 leading-none">…</p>
            <p>…{preview.tail}</p>
          </div>
        )}
      </div>

      {/* Primary Selected Metric */}
      <div className="flex items-baseline justify-between border-t border-border/40 pt-1.5 font-mono">
        <span className="text-[11px] text-muted-foreground font-medium">
          {metric.label}:
        </span>
        <span className="text-sm font-bold text-foreground">
          {point.effectiveValue > 0 && metric.hasBaseline
            ? `+${point.effectiveValue}`
            : point.effectiveValue}
        </span>
      </div>

      {/* Secondary Metrics Breakdown */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-border/30 pt-1 font-mono text-[10px] text-muted-foreground">
        <div>Int: {point.metrics.intensity}</div>
        <div>Ten: {point.metrics.tension}</div>
        <div>
          Val:{" "}
          {point.metrics.valence > 0
            ? `+${point.metrics.valence}`
            : point.metrics.valence}
        </div>
        <div>
          Temp:{" "}
          {point.metrics.temperature > 0
            ? `+${point.metrics.temperature}`
            : point.metrics.temperature}
        </div>
        <div className="col-span-2 pt-0.5 text-muted-foreground/80">
          Confidence: {Math.round(point.metrics.confidence * 100)}%
        </div>
      </div>

      {/* Context Footer (Movement/Phase) */}
      {(point.movementKind || point.phaseLabel) && (
        <div className="flex items-center justify-between border-t border-border/30 pt-1 font-mono text-[10px] text-muted-foreground">
          {point.phaseLabel && (
            <span className="truncate">Phase: {point.phaseLabel}</span>
          )}
          {point.movementKind && (
            <span className="font-semibold uppercase text-foreground">
              {point.movementKind}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MovementTooltipContent({ marker }: { marker: GraphMovementMarker }) {
  return (
    <div className="space-y-1.5 font-mono">
      <div className="flex items-center justify-between border-b border-border/50 pb-1">
        <span className="font-bold uppercase text-foreground">
          {marker.kind}
        </span>
        <span className="text-[10px] text-muted-foreground">
          mag: {marker.magnitude}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Confidence: {Math.round(marker.confidence * 100)}%
      </div>
      {marker.rationale && (
        <p className="line-clamp-2 font-sans text-xs italic text-muted-foreground">
          "{marker.rationale}"
        </p>
      )}
    </div>
  );
}
