import { useState } from "react";
import type { CanonicalAnalysis, AnalysisSegment } from "../types";
import { Loader2, Activity, Sparkles, Layers, ArrowUpRight } from "lucide-react";

interface GraphWorkspaceProps {
  analysis: CanonicalAnalysis | null;
  isAnalyzing: boolean;
  modelId?: string;
  onSelectSegment?: (segment: AnalysisSegment) => void;
  selectedSegmentId?: string | null;
}

export function GraphWorkspace({
  analysis,
  isAnalyzing,
  modelId = "gemini-3.8-flash",
  onSelectSegment,
  selectedSegmentId,
}: GraphWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "segments" | "movements">("overview");

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
              Enter or paste a poem in the editor and click <strong className="font-medium text-foreground">Analyze</strong> in the top bar to inspect its tension, intensity, and structural movements.
            </p>
          </div>
          <div className="pt-2">
            <span className="font-mono text-[11px] text-muted-foreground/70">
              Provider: {modelId} • Custom SVG Graph Engine (Task 06)
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
      {/* Pending Analysis Banner (non-destructive) */}
      {isAnalyzing && (
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-center gap-2 border-b border-border/80 bg-muted/95 py-2 text-xs font-mono text-foreground backdrop-blur-xs animate-in fade-in duration-150">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Analyzing text dynamics with {modelId}...</span>
        </div>
      )}

      {analysis && (
        <div className="flex h-full flex-col overflow-hidden">
          {/* Header Bar */}
          <div className="flex h-11 items-center justify-between border-b border-border/70 px-4 py-2 bg-card select-none">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                Structure Overview
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                <Sparkles className="size-3" />
                {analysis.overall.dominantShape}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  activeTab === "overview"
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("segments")}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  activeTab === "segments"
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Segments ({analysis.segments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("movements")}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  activeTab === "movements"
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Movements ({analysis.movements.length})
              </button>
            </div>
          </div>

          {/* Workspace Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "overview" && (
              <div className="max-w-3xl space-y-6">
                {/* Overall Summary */}
                <div className="rounded-lg border border-border/70 bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Summary
                    </h3>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Schema v{analysis.schemaVersion}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">
                    {analysis.overall.summary}
                  </p>
                </div>

                {/* Phases */}
                <div className="space-y-3">
                  <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5" />
                    Structural Phases ({analysis.phases.length})
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {analysis.phases.map((phase) => (
                      <div
                        key={phase.id}
                        className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-medium text-foreground">
                            {phase.label}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {phase.kind}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                          <span>
                            {phase.startSegmentId} → {phase.endSegmentId}
                          </span>
                          <span>{Math.round(phase.confidence * 100)}% conf</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Task 06 notice banner */}
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground font-mono space-y-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <ArrowUpRight className="size-3.5" />
                    Task 06 Graph Engine Placeholder
                  </div>
                  <p>
                    This structured data is validated and persisted in SQLite. Task 06 will render the custom SVG dynamic graph, discontinuous curve geometry, drag overrides, and node inspector.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "segments" && (
              <div className="max-w-4xl space-y-3">
                <div className="text-xs text-muted-foreground font-mono">
                  Click a segment to inspect and highlight its corresponding lines in the editor:
                </div>
                <div className="divide-y divide-border/40 rounded-lg border border-border/70 bg-card">
                  {analysis.segments.map((seg) => {
                    const isSelected = seg.id === selectedSegmentId;
                    return (
                      <div
                        key={seg.id}
                        onClick={() => onSelectSegment?.(seg)}
                        className={`flex cursor-pointer flex-col gap-2 p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between ${
                          isSelected ? "bg-muted/80" : ""
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {seg.id}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              ({seg.startUnitId} … {seg.endUnitId})
                            </span>
                          </div>
                          {seg.rationale && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {seg.rationale}
                            </p>
                          )}
                        </div>

                        {/* Metrics Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                          <span className="rounded bg-muted px-2 py-0.5 text-foreground">
                            Int: {seg.intensity}
                          </span>
                          <span className="rounded bg-muted px-2 py-0.5 text-foreground">
                            Ten: {seg.tension}
                          </span>
                          <span className="rounded bg-muted px-2 py-0.5 text-foreground">
                            Val: {seg.valence > 0 ? `+${seg.valence}` : seg.valence}
                          </span>
                          <span className="rounded bg-muted px-2 py-0.5 text-foreground">
                            Temp: {seg.temperature > 0 ? `+${seg.temperature}` : seg.temperature}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {Math.round(seg.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "movements" && (
              <div className="max-w-3xl space-y-3">
                <div className="text-xs text-muted-foreground font-mono">
                  Movements connecting structural segment spans:
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {analysis.movements.map((mov) => (
                    <div
                      key={mov.id}
                      className="rounded-lg border border-border/60 bg-card p-3 space-y-1.5 font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-foreground">
                          {mov.kind}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          mag: {mov.magnitude}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {mov.startSegmentId} → {mov.endSegmentId}
                        </span>
                        <span>{Math.round(mov.confidence * 100)}% conf</span>
                      </div>
                      {mov.rationale && (
                        <p className="text-xs font-sans text-muted-foreground/90 line-clamp-2 pt-1 border-t border-border/30">
                          {mov.rationale}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
