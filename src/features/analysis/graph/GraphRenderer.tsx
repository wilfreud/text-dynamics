import { useRef, useState } from "react";
import type {
  GraphMovementMarker,
  GraphPoint,
  GraphViewModel,
} from "./graphTypes";
import type { SegmentGroup } from "../types";
import { unprojectY } from "./graphGeometry";

interface GraphRendererProps {
  viewModel: GraphViewModel;
  selectedSegmentIds: string[];
  groups?: SegmentGroup[];
  onSelectSegment: (segmentId: string, isMulti: boolean) => void;
  onSelectMovement?: (movementId: string) => void;
  onDragOverride?: (segmentId: string, newValue: number) => void;
  onDragEnd?: () => void;
  onHoverTarget: (
    target:
      | { type: "point"; point: GraphPoint }
      | { type: "movement"; marker: GraphMovementMarker }
      | null
  ) => void;
}

export function GraphRenderer({
  viewModel,
  selectedSegmentIds,
  groups = [],
  onSelectSegment,
  onSelectMovement,
  onDragOverride,
  onDragEnd,
  onHoverTarget,
}: GraphRendererProps) {
  const { viewport, points, paths, phaseBands, movementMarkers, grid } =
    viewModel;

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<{
    segmentId: string;
    startY: number;
    hasMoved: boolean;
  } | null>(null);

  const plotHeight = Math.max(
    10,
    viewport.height - viewport.padding.top - viewport.padding.bottom
  );

  // Pointer drag event handlers for vertical node override editing
  function handleNodePointerDown(
    e: React.PointerEvent<SVGGElement>,
    point: GraphPoint
  ) {
    if (e.button !== 0) return; // Only primary button
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    setDragState({
      segmentId: point.segmentId,
      startY: e.clientY,
      hasMoved: false,
    });
    onHoverTarget(null);
  }

  function handleNodePointerMove(e: React.PointerEvent<SVGGElement>) {
    if (!dragState || !svgRef.current) return;
    const dy = Math.abs(e.clientY - dragState.startY);
    if (dy > 3 && !dragState.hasMoved) {
      setDragState((prev) => (prev ? { ...prev, hasMoved: true } : null));
    }

    if (dragState.hasMoved || dy > 3) {
      const rect = svgRef.current.getBoundingClientRect();
      const relativePixelY =
        (e.clientY - rect.top) * (viewport.height / rect.height);

      const newValue = unprojectY(
        relativePixelY,
        viewModel.metric,
        viewport
      );
      onDragOverride?.(dragState.segmentId, newValue);
    }
  }

  function handleNodePointerUp(
    e: React.PointerEvent<SVGGElement>,
    point: GraphPoint
  ) {
    if (!dragState) return;
    e.stopPropagation();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already lost
    }

    if (dragState.hasMoved) {
      onDragEnd?.();
    } else {
      // Single click -> select segment (respecting Shift/Cmd/Ctrl multi-select)
      const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
      onSelectSegment(point.segmentId, isMulti);
    }

    setDragState(null);
  }

  return (
    <svg
      ref={svgRef}
      width={viewport.width}
      height={viewport.height}
      className={`overflow-visible select-none text-foreground ${
        dragState?.hasMoved ? "cursor-ns-resize" : ""
      }`}
      aria-label="Dynamic structural graph"
      role="graphics-document"
    >
      {/* 1. Background Phase Bands */}
      <g className="phase-bands" opacity="0.6">
        {phaseBands.map((band) => (
          <g key={band.id}>
            <rect
              x={band.x}
              y={viewport.padding.top}
              width={band.width}
              height={plotHeight}
              fill="currentColor"
              className="text-muted/40"
            />
            {/* Phase Separator Line */}
            <line
              x1={band.x}
              y1={viewport.padding.top}
              x2={band.x}
              y2={viewport.padding.top + plotHeight}
              stroke="currentColor"
              strokeDasharray="2 3"
              className="text-border"
            />
            {/* Phase Label at Bottom */}
            <text
              x={band.x + band.width / 2}
              y={viewport.height - 18}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[9px] uppercase tracking-wider"
            >
              {band.label}
            </text>
          </g>
        ))}
      </g>

      {/* 2. Grid & Y-Axis Baseline */}
      <g className="grid-lines">
        {grid.ticks.map((tick) => (
          <g key={`tick-${tick.value}`}>
            <line
              x1={viewport.padding.left}
              y1={tick.y}
              x2={viewport.width - viewport.padding.right}
              y2={tick.y}
              stroke="currentColor"
              strokeDasharray={tick.value === 0 ? undefined : "2 3"}
              className={
                tick.value === 0
                  ? "text-foreground/40"
                  : "text-border/60"
              }
              strokeWidth={tick.value === 0 ? "1.2" : "1"}
            />
            <text
              x={viewport.padding.left - 8}
              y={tick.y + 3.5}
              textAnchor="end"
              className="fill-muted-foreground/80 font-mono text-[10px]"
            >
              {tick.label}
            </text>
          </g>
        ))}
      </g>

      {/* 3. Movement Span Markers (Top Gutter) */}
      <g className="movement-markers">
        {movementMarkers.map((mov) => {
          const midX = (mov.xStart + mov.xEnd) / 2;
          const spanWidth = Math.max(12, mov.xEnd - mov.xStart);

          return (
            <g
              key={mov.id}
              tabIndex={0}
              role="button"
              aria-label={`Movement ${mov.kind}`}
              className="cursor-pointer outline-none group"
              onClick={() => onSelectMovement?.(mov.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectMovement?.(mov.id);
                }
              }}
              onMouseEnter={() => {
                if (!dragState) onHoverTarget({ type: "movement", marker: mov });
              }}
              onMouseLeave={() => onHoverTarget(null)}
              onFocus={() => {
                if (!dragState) onHoverTarget({ type: "movement", marker: mov });
              }}
              onBlur={() => onHoverTarget(null)}
            >
              {/* Invisible Hit Area */}
              <rect
                x={mov.xStart - 4}
                y={mov.y - 12}
                width={spanWidth + 8}
                height={20}
                fill="transparent"
              />
              {/* Bracket Line */}
              <line
                x1={mov.xStart}
                y1={mov.y}
                x2={mov.xEnd}
                y2={mov.y}
                stroke="currentColor"
                strokeWidth="1.2"
                className="text-muted-foreground/60 group-hover:text-foreground transition-colors"
              />
              {/* Left End Tick */}
              <line
                x1={mov.xStart}
                y1={mov.y - 3}
                x2={mov.xStart}
                y2={mov.y + 3}
                stroke="currentColor"
                strokeWidth="1.2"
                className="text-muted-foreground/60 group-hover:text-foreground"
              />
              {/* Right End Tick */}
              <line
                x1={mov.xEnd}
                y1={mov.y - 3}
                x2={mov.xEnd}
                y2={mov.y + 3}
                stroke="currentColor"
                strokeWidth="1.2"
                className="text-muted-foreground/60 group-hover:text-foreground"
              />
              {/* Label */}
              <text
                x={midX}
                y={mov.y - 5}
                textAnchor="middle"
                className="fill-muted-foreground group-hover:fill-foreground font-mono text-[9px] uppercase tracking-wider font-semibold transition-colors"
              >
                {mov.kind}
              </text>
            </g>
          );
        })}
      </g>

      {/* 4. Semantic Paths */}
      <g className="paths">
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={path.isRupture ? "1.5" : "2"}
            strokeDasharray={path.isRupture ? "4 4" : undefined}
            className="text-foreground transition-all"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* 5. User Groups Subtle Visual Indicators (Bottom Strip) */}
      <g className="groups-indicators" opacity="0.7">
        {groups.map((group, gIdx) => {
          const groupPoints = points.filter((p) =>
            group.segmentIds.includes(p.segmentId)
          );
          if (groupPoints.length === 0) return null;

          const minX = Math.min(...groupPoints.map((p) => p.x));
          const maxX = Math.max(...groupPoints.map((p) => p.x));
          const lineY = viewport.height - 4 - gIdx * 4;

          return (
            <g key={group.id}>
              <line
                x1={minX - 4}
                y1={lineY}
                x2={maxX + 4}
                y2={lineY}
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground"
              />
            </g>
          );
        })}
      </g>

      {/* 6. Ordered Segment Nodes */}
      <g className="nodes">
        {points.map((point) => {
          const isSelected = selectedSegmentIds.includes(point.segmentId);
          const isDraggingThis = dragState?.segmentId === point.segmentId;

          return (
            <g
              key={point.segmentId}
              tabIndex={0}
              role="button"
              aria-label={`${point.segmentId}: ${point.lineRangeLabel}`}
              className={`outline-none group ${
                isDraggingThis ? "cursor-ns-resize" : "cursor-pointer"
              }`}
              onPointerDown={(e) => handleNodePointerDown(e, point)}
              onPointerMove={handleNodePointerMove}
              onPointerUp={(e) => handleNodePointerUp(e, point)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSegment(
                    point.segmentId,
                    e.shiftKey || e.metaKey || e.ctrlKey
                  );
                }
              }}
              onMouseEnter={() => {
                if (!dragState) onHoverTarget({ type: "point", point });
              }}
              onMouseLeave={() => {
                if (!dragState) onHoverTarget(null);
              }}
              onFocus={() => {
                if (!dragState) onHoverTarget({ type: "point", point });
              }}
              onBlur={() => onHoverTarget(null)}
            >
              {/* Larger Transparent Hit Target */}
              <circle cx={point.x} cy={point.y} r="16" fill="transparent" />

              {/* Multi-Selection or Single-Selection Halo */}
              {isSelected && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-foreground animate-pulse"
                />
              )}

              {/* Node Outer Circle */}
              <circle
                cx={point.x}
                cy={point.y}
                r={point.isOverridden ? "5.5" : "4.5"}
                fill="var(--color-background)"
                stroke="currentColor"
                strokeWidth={isSelected ? "2.5" : "2"}
                className="text-foreground transition-transform group-hover:scale-125"
              />

              {/* User Override Inner Dot */}
              {point.isOverridden && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="2.5"
                  fill="currentColor"
                  className="text-foreground"
                />
              )}

              {/* Bottom Node Index Label */}
              <text
                x={point.x}
                y={viewport.height - viewport.padding.bottom + 18}
                textAnchor="middle"
                className={`font-mono text-[10px] transition-colors ${
                  isSelected
                    ? "fill-foreground font-semibold"
                    : "fill-muted-foreground/80 group-hover:fill-foreground"
                }`}
              >
                {point.index + 1}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
