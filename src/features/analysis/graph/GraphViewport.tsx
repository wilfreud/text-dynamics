import { useState, useRef, useEffect, useMemo } from "react";
import type { SourceUnit } from "../unitization/unitizer";
import type {
  CanonicalAnalysis,
  MovementKind,
  SegmentOverride,
  UserOverrides,
} from "../types";
import {
  METRIC_DESCRIPTORS,
  type MetricKind,
  type GraphViewportConfig as ViewportConfig,
} from "./graphTypes";
import { DEFAULT_VIEWPORT_PADDING } from "./graphGeometry";
import { buildGraphViewModel } from "./graphViewModel";
import { GraphRenderer } from "./GraphRenderer";
import { GraphTooltip, type TooltipTarget } from "./GraphTooltip";
import { SegmentInspector } from "./SegmentInspector";
import { MovementInspector } from "./MovementInspector";
import { GroupManager } from "./GroupManager";
import { Activity, Loader2, Info } from "lucide-react";

interface GraphViewportProps {
  analysis: CanonicalAnalysis | null;
  overrides?: UserOverrides;
  sourceUnits: SourceUnit[];
  isAnalyzing: boolean;
  selectedSegmentIds: string[];
  onSelectSegment: (segmentId: string, isMulti: boolean) => void;
  onUpdateSegmentOverride: (segmentId: string, override: SegmentOverride) => void;
  onResetSegmentOverride: (segmentId: string) => void;
  onUpdateMovementOverride: (movementId: string, newKind: MovementKind) => void;
  onResetMovementOverride: (movementId: string) => void;
  onAddGroup: (label: string, segmentIds: string[]) => void;
  onRemoveGroup: (groupId: string) => void;
  onSelectGroup: (segmentIds: string[]) => void;
  onClearSelection: () => void;
  onDragOverride: (segmentId: string, metric: MetricKind, newValue: number) => void;
  onDragEnd: () => void;
  analysisId?: string | null;
  modelId?: string;
}

export function GraphViewport({
  analysis,
  overrides,
  sourceUnits,
  isAnalyzing,
  selectedSegmentIds,
  onSelectSegment,
  onUpdateSegmentOverride,
  onResetSegmentOverride,
  onUpdateMovementOverride,
  onResetMovementOverride,
  onAddGroup,
  onRemoveGroup,
  onSelectGroup,
  onClearSelection,
  onDragOverride,
  onDragEnd,
  analysisId,
  modelId = "gemini-3.8-flash",
}: GraphViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 400,
  });

  const [selectedMetric, setSelectedMetric] = useState<MetricKind>("intensity");
  const [hoverTarget, setHoverTarget] = useState<TooltipTarget | null>(null);
  const [inspectedMovementId, setInspectedMovementId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // ResizeObserver to react to container size changes (editor collapse/expand or window resize)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const currentDescriptor = METRIC_DESCRIPTORS[selectedMetric];

  const viewportConfig: ViewportConfig = useMemo(() => {
    return {
      width: dimensions.width,
      height: dimensions.height,
      padding: DEFAULT_VIEWPORT_PADDING,
    };
  }, [dimensions]);

  const viewModel = useMemo(() => {
    if (!analysis) return null;
    return buildGraphViewModel(
      analysis,
      overrides,
      sourceUnits,
      selectedMetric,
      viewportConfig
    );
  }, [analysis, overrides, sourceUnits, selectedMetric, viewportConfig]);

  // Handle single segment inspector selection
  const singleSelectedSegment = useMemo(() => {
    if (selectedSegmentIds.length !== 1 || !analysis) return null;
    return analysis.segments.find((s) => s.id === selectedSegmentIds[0]) ?? null;
  }, [selectedSegmentIds, analysis]);

  const singleSelectedPoint = useMemo(() => {
    if (!singleSelectedSegment || !viewModel) return null;
    return (
      viewModel.points.find((p) => p.segmentId === singleSelectedSegment.id) ??
      null
    );
  }, [singleSelectedSegment, viewModel]);

  const inspectedMovement = useMemo(() => {
    if (!inspectedMovementId || !analysis) return null;
    return (
      analysis.movements.find((m) => m.id === inspectedMovementId) ?? null
    );
  }, [inspectedMovementId, analysis]);

  // When segment selection changes, ensure inspector is open
  useEffect(() => {
    if (selectedSegmentIds.length === 1) {
      setIsInspectorOpen(true);
      setInspectedMovementId(null);
    }
  }, [selectedSegmentIds]);

  function handleSelectMovement(movementId: string) {
    setInspectedMovementId(movementId);
  }

  function handleNodeDrag(segmentId: string, newValue: number) {
    onDragOverride(segmentId, selectedMetric, newValue);
  }

  if (!analysis && !isAnalyzing) {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center p-8 text-center select-none bg-background">
        <div className="max-w-md space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-border/80 bg-muted/20">
            <Activity className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
              Dynamic Structure Graph
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Enter or paste a poem in the editor and click{" "}
              <strong className="font-medium text-foreground">Analyze</strong> in
              the top bar to render its dynamic structural graph.
            </p>
          </div>
          <div className="pt-2">
            <span className="font-mono text-[11px] text-muted-foreground/70">
              Provider: {modelId} • Custom SVG Semantic Graph
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
      {/* Top Controls: Metric Selector & Status */}
      <div className="flex h-11 items-center justify-between border-b border-border/70 px-4 py-2 bg-card select-none">
        {/* Metric Selector Buttons */}
        <div className="flex items-center gap-1">
          {(["intensity", "tension", "valence", "temperature"] as MetricKind[]).map(
            (metricKey) => {
              const isSelected = selectedMetric === metricKey;
              const desc = METRIC_DESCRIPTORS[metricKey];
              return (
                <button
                  key={metricKey}
                  type="button"
                  onClick={() => setSelectedMetric(metricKey)}
                  title={desc.description}
                  className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                    isSelected
                      ? "bg-foreground text-background font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {desc.label}
                </button>
              );
            }
          )}
        </div>

        {/* Selected Metric Help / Semantic Summary */}
        <div className="flex items-center gap-3">
          {analysis && (
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <Info className="size-3.5" />
              <span className="max-w-xs truncate font-sans text-[11px] text-muted-foreground">
                {currentDescriptor.description}
              </span>
            </div>
          )}
          {analysis?.overall.dominantShape && (
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
              {analysis.overall.dominantShape}
            </span>
          )}
        </div>
      </div>

      {/* Non-destructive loading banner while analysis is running */}
      {isAnalyzing && (
        <div className="absolute top-11 inset-x-0 z-20 flex items-center justify-center gap-2 border-b border-border/80 bg-muted/95 py-2 text-xs font-mono text-foreground backdrop-blur-xs animate-in fade-in duration-150">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Analyzing text dynamics with {modelId}...</span>
        </div>
      )}

      {/* Main SVG Graph Container */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {viewModel && (
          <>
            <GraphRenderer
              viewModel={viewModel}
              selectedSegmentIds={selectedSegmentIds}
              groups={overrides?.groups}
              analysisId={analysisId}
              onSelectSegment={onSelectSegment}
              onSelectMovement={handleSelectMovement}
              onDragOverride={handleNodeDrag}
              onDragEnd={onDragEnd}
              onHoverTarget={setHoverTarget}
            />
            <GraphTooltip
              target={hoverTarget}
              metric={currentDescriptor}
              containerWidth={dimensions.width}
              containerHeight={dimensions.height}
            />
          </>
        )}

        {/* Segment Inspector Popover */}
        {singleSelectedSegment && isInspectorOpen && (
          <SegmentInspector
            segment={singleSelectedSegment}
            excerpt={singleSelectedPoint?.excerpt ?? ""}
            lineRangeLabel={singleSelectedPoint?.lineRangeLabel ?? ""}
            overrides={overrides}
            onUpdateOverride={onUpdateSegmentOverride}
            onResetSegmentOverride={onResetSegmentOverride}
            onAddGroup={onAddGroup}
            onRemoveGroup={onRemoveGroup}
            onClose={() => setIsInspectorOpen(false)}
          />
        )}

        {/* Movement Inspector Popover */}
        {inspectedMovement && (
          <MovementInspector
            movement={inspectedMovement}
            overrides={overrides}
            onUpdateMovementOverride={onUpdateMovementOverride}
            onResetMovementOverride={onResetMovementOverride}
            onClose={() => setInspectedMovementId(null)}
          />
        )}

        {/* Group Manager for Multi-selection and Groups */}
        <GroupManager
          selectedSegmentIds={selectedSegmentIds}
          groups={overrides?.groups ?? []}
          onCreateGroup={onAddGroup}
          onDeleteGroup={onRemoveGroup}
          onSelectGroup={onSelectGroup}
          onClearSelection={onClearSelection}
        />
      </div>
    </main>
  );
}
