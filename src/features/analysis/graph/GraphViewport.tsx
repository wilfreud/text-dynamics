import { useState, useRef, useEffect, useMemo } from "react";
import type { SourceUnit } from "../unitization/unitizer";
import type { CanonicalAnalysis, UserOverrides } from "../types";
import {
  METRIC_DESCRIPTORS,
  type MetricKind,
  type GraphViewportConfig as ViewportConfig,
} from "./graphTypes";
import { DEFAULT_VIEWPORT_PADDING } from "./graphGeometry";
import { buildGraphViewModel } from "./graphViewModel";
import { GraphRenderer } from "./GraphRenderer";
import { GraphTooltip, type TooltipTarget } from "./GraphTooltip";
import { Activity, Loader2, Info } from "lucide-react";

interface GraphViewportProps {
  analysis: CanonicalAnalysis | null;
  overrides?: UserOverrides;
  sourceUnits: SourceUnit[];
  isAnalyzing: boolean;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  modelId?: string;
}

export function GraphViewport({
  analysis,
  overrides,
  sourceUnits,
  isAnalyzing,
  selectedSegmentId,
  onSelectSegment,
  modelId = "gemini-3.8-flash",
}: GraphViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 400,
  });

  const [selectedMetric, setSelectedMetric] = useState<MetricKind>("intensity");
  const [hoverTarget, setHoverTarget] = useState<TooltipTarget | null>(null);

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
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
      >
        {viewModel && (
          <>
            <GraphRenderer
              viewModel={viewModel}
              selectedSegmentId={selectedSegmentId}
              onSelectSegment={onSelectSegment}
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
      </div>
    </main>
  );
}
