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
  type CurveInterpolation,
  type GraphViewportConfig as ViewportConfig,
} from "./graphTypes";
import { DEFAULT_VIEWPORT_PADDING } from "./graphGeometry";
import { buildGraphViewModel } from "./graphViewModel";
import { GraphRenderer } from "./GraphRenderer";
import { SegmentInspector } from "./SegmentInspector";
import { MovementInspector } from "./MovementInspector";
import { GroupManager } from "./GroupManager";
import { MetricHelpDialog } from "./MetricHelpDialog";
import { PassageReaderDialog } from "./PassageReaderDialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { GraphAnalyzingState } from "./GraphAnalyzingState";
import { GraphScanningOverlay } from "./GraphScanningOverlay";
import { Activity, Loader2, Info, Spline } from "lucide-react";

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
  sourceText?: string;
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
  sourceText = "",
}: GraphViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 400,
  });

  const [selectedMetric, setSelectedMetric] = useState<MetricKind>("intensity");
  const [inspectedMovementId, setInspectedMovementId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isMetricHelpOpen, setIsMetricHelpOpen] = useState(false);
  const [isPassageReaderOpen, setIsPassageReaderOpen] = useState(false);
  const [curveInterpolation, setCurveInterpolation] = useState<CurveInterpolation>(() => {
    try {
      const saved = localStorage.getItem("text_dynamics_curve_mode");
      if (saved === "linear" || saved === "smooth") return saved;
    } catch {
      // Ignore localStorage access failures in restricted environments
    }
    return "smooth";
  });

  // ResizeObserver to react to container size changes (editor collapse/expand or window resize)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w > 0 && h > 0) {
        setDimensions((prev) => {
          if (prev.width === w && prev.height === h) return prev;
          return { width: w, height: h };
        });
      }
    };

    // Measure immediately upon mount
    measure();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w > 0 && h > 0) {
          setDimensions((prev) => {
            if (prev.width === w && prev.height === h) return prev;
            return { width: w, height: h };
          });
        }
      }
    });

    observer.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
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
      viewportConfig,
      curveInterpolation,
      sourceText
    );
  }, [
    analysis,
    overrides,
    sourceUnits,
    selectedMetric,
    viewportConfig,
    curveInterpolation,
    sourceText,
  ]);

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

  // Derived state for full passage reader dialog
  const readingSegmentIndex = useMemo(() => {
    if (!analysis || selectedSegmentIds.length !== 1) return -1;
    return analysis.segments.findIndex((s) => s.id === selectedSegmentIds[0]);
  }, [analysis, selectedSegmentIds]);

  const readingSegment = useMemo(() => {
    if (!analysis || readingSegmentIndex < 0) return null;
    return analysis.segments[readingSegmentIndex] ?? null;
  }, [analysis, readingSegmentIndex]);

  const readingPoint = useMemo(() => {
    if (!viewModel || !readingSegment) return null;
    return (
      viewModel.points.find((p) => p.segmentId === readingSegment.id) ?? null
    );
  }, [viewModel, readingSegment]);

  const readingUnitRangeLabel = useMemo(() => {
    if (!readingPoint) return "";
    return readingPoint.startUnitId === readingPoint.endUnitId
      ? readingPoint.startUnitId
      : `${readingPoint.startUnitId}–${readingPoint.endUnitId}`;
  }, [readingPoint]);


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

  return (
    <main className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      {/* Top Controls: Metric Selector & Status */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/70 px-4 py-2 bg-card select-none">
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

        {/* Metric Controls, Info & Semantic Summary */}
        <div className="flex items-center gap-2">
          {analysis?.overall.dominantShape && (
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
              {analysis.overall.dominantShape}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setCurveInterpolation((prev) => {
                const next: CurveInterpolation = prev === "smooth" ? "linear" : "smooth";
                try {
                  localStorage.setItem("text_dynamics_curve_mode", next);
                } catch {
                  // Ignore localStorage error
                }
                return next;
              });
            }}
            title={
              curveInterpolation === "smooth"
                ? "Mode : Courbe fluide (cliquer pour passer en tracé linéaire)"
                : "Mode : Tracé linéaire (cliquer pour passer en courbe fluide)"
            }
            aria-label={`Toggle curve interpolation mode, currently ${curveInterpolation}`}
            className={`flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer ${
              curveInterpolation === "smooth"
                ? "border-border bg-muted/80 text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Spline className="size-3" />
            <span>{curveInterpolation === "smooth" ? "Smooth" : "Linear"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMetricHelpOpen(true)}
            title={`Definitions & examples (${currentDescriptor.label})`}
            aria-label={`Open metric guide for ${currentDescriptor.label}`}
            className="flex h-6 w-6 items-center justify-center rounded border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <Info className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Non-destructive loading banner while analysis is running */}
      {isAnalyzing && (
        <div className="absolute top-11 inset-x-0 z-20 flex items-center justify-center gap-2 border-b border-border/80 bg-muted/95 py-2 text-xs font-mono text-foreground backdrop-blur-xs animate-in fade-in duration-150">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Analyzing text dynamics with {modelId}...</span>
        </div>
      )}

      {/* Main Workspace: SVG Graph and Conditional Resizable Inspector Sidebar */}
      <div className="flex-1 min-h-0 min-w-0 w-full h-full overflow-hidden">
        <ResizablePanelGroup
          id="graph-viewport-panels"
          orientation="horizontal"
          className="h-full w-full"
        >
          {/* Main SVG Graph Canvas Panel */}
          <ResizablePanel
            id="graph-canvas-panel"
            minSize="40%"
            className="relative h-full w-full min-h-0 min-w-0 overflow-hidden"
          >
            <div
              ref={containerRef}
              className="relative w-full h-full min-h-0 min-w-0 overflow-hidden bg-background"
            >
              {!analysis && !isAnalyzing ? (
                <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center select-none bg-background">
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
                </div>
              ) : isAnalyzing && !viewModel ? (
                <GraphAnalyzingState modelId={modelId} />
              ) : viewModel ? (
                <div className="relative w-full h-full">
                  <GraphRenderer
                    viewModel={viewModel}
                    selectedSegmentIds={selectedSegmentIds}
                    groups={overrides?.groups}
                    analysisId={analysisId}
                    onSelectSegment={onSelectSegment}
                    onSelectMovement={handleSelectMovement}
                    onDragOverride={handleNodeDrag}
                    onDragEnd={onDragEnd}
                  />
                  {isAnalyzing && <GraphScanningOverlay modelId={modelId} />}
                </div>
              ) : null}
            </div>
          </ResizablePanel>

          {/* Conditional Resizable Inspector Sidebar */}
          {Boolean((singleSelectedSegment && isInspectorOpen) || inspectedMovement) && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="graph-inspector-sidebar"
                defaultSize="32%"
                minSize="22%"
                maxSize="50%"
                collapsible={true}
                collapsedSize="0%"
                className="h-full flex flex-col bg-card border-l border-border/70 overflow-hidden"
              >
                {singleSelectedSegment && isInspectorOpen && (
                  <SegmentInspector
                    segment={singleSelectedSegment}
                    excerpt={singleSelectedPoint?.excerpt ?? ""}
                    sourcePassage={singleSelectedPoint?.sourcePassage ?? ""}
                    lineRangeLabel={singleSelectedPoint?.lineRangeLabel ?? ""}
                    overrides={overrides}
                    onUpdateOverride={onUpdateSegmentOverride}
                    onResetSegmentOverride={onResetSegmentOverride}
                    onAddGroup={onAddGroup}
                    onRemoveGroup={onRemoveGroup}
                    onClose={() => setIsInspectorOpen(false)}
                    onOpenPassageReader={() => setIsPassageReaderOpen(true)}
                  />
                )}

                {inspectedMovement && (
                  <MovementInspector
                    movement={inspectedMovement}
                    overrides={overrides}
                    onUpdateMovementOverride={onUpdateMovementOverride}
                    onResetMovementOverride={onResetMovementOverride}
                    onClose={() => setInspectedMovementId(null)}
                  />
                )}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

        {/* Group Manager for Multi-selection and Groups */}
        <GroupManager
          selectedSegmentIds={selectedSegmentIds}
          groups={overrides?.groups ?? []}
          onCreateGroup={onAddGroup}
          onDeleteGroup={onRemoveGroup}
          onSelectGroup={onSelectGroup}
          onClearSelection={onClearSelection}
        />

        {/* Metric Definitions & Examples Modal */}
        <MetricHelpDialog
          open={isMetricHelpOpen}
          onOpenChange={setIsMetricHelpOpen}
          initialMetric={selectedMetric}
        />

        {/* Full Exact Source Passage Reader Dialog */}
        <PassageReaderDialog
          open={isPassageReaderOpen}
          onOpenChange={setIsPassageReaderOpen}
          segment={readingSegment}
          segmentIndex={readingSegmentIndex}
          totalSegments={analysis?.segments.length ?? 0}
          sourcePassage={readingPoint?.sourcePassage ?? ""}
          unitRangeLabel={readingUnitRangeLabel}
          activeMetric={currentDescriptor}
          effectiveMetricValue={readingPoint?.effectiveValue ?? 0}
          movementKind={readingPoint?.movementKind}
          phaseLabel={readingPoint?.phaseLabel}
          hasPrevious={readingSegmentIndex > 0}
          hasNext={
            readingSegmentIndex >= 0 &&
            readingSegmentIndex < (analysis?.segments.length ?? 0) - 1
          }
          onNavigatePrevious={() => {
            if (analysis && readingSegmentIndex > 0) {
              onSelectSegment(analysis.segments[readingSegmentIndex - 1].id, false);
            }
          }}
          onNavigateNext={() => {
            if (analysis && readingSegmentIndex < analysis.segments.length - 1) {
              onSelectSegment(analysis.segments[readingSegmentIndex + 1].id, false);
            }
          }}
        />
    </main>
  );
}
