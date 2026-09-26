import { useState } from "react";
import type {
  AnalysisSegment,
  SegmentOverride,
  UserOverrides,
} from "../types";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { X, RotateCcw, Users, Plus, Trash2, Maximize2 } from "lucide-react";

interface SegmentInspectorProps {
  segment: AnalysisSegment;
  excerpt: string;
  lineRangeLabel: string;
  overrides?: UserOverrides;
  onUpdateOverride: (segmentId: string, override: SegmentOverride) => void;
  onResetSegmentOverride: (segmentId: string) => void;
  onAddGroup: (label: string, segmentIds: string[]) => void;
  onRemoveGroup: (groupId: string) => void;
  onClose: () => void;
  onOpenPassageReader?: () => void;
}

export function SegmentInspector({
  segment,
  excerpt,
  lineRangeLabel,
  overrides,
  onUpdateOverride,
  onResetSegmentOverride,
  onAddGroup,
  onRemoveGroup,
  onClose,
  onOpenPassageReader,
}: SegmentInspectorProps) {
  const currentSegOverride = overrides?.segmentOverrides[segment.id];
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const effectiveIntensity =
    currentSegOverride?.intensity ?? segment.intensity;
  const effectiveTension =
    currentSegOverride?.tension ?? segment.tension;
  const effectiveValence =
    currentSegOverride?.valence ?? segment.valence;
  const effectiveTemperature =
    currentSegOverride?.temperature ?? segment.temperature;

  const hasAnyOverride =
    currentSegOverride?.intensity !== undefined ||
    currentSegOverride?.tension !== undefined ||
    currentSegOverride?.valence !== undefined ||
    currentSegOverride?.temperature !== undefined;

  function handleMetricChange(
    key: keyof SegmentOverride,
    valStr: string,
    min: number,
    max: number
  ) {
    const val = parseFloat(valStr);
    if (Number.isNaN(val)) return;
    const clamped = Math.min(Math.max(val, min), max);

    onUpdateOverride(segment.id, {
      ...currentSegOverride,
      [key]: Math.round(clamped * 10) / 10,
    });
  }

  function handleResetMetric(key: keyof SegmentOverride) {
    if (!currentSegOverride) return;
    const nextOverride = { ...currentSegOverride };
    delete nextOverride[key];
    onUpdateOverride(segment.id, nextOverride);
  }

  // Groups this segment belongs to
  const matchingGroups = (overrides?.groups ?? []).filter((g) =>
    g.segmentIds.includes(segment.id)
  );

  function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newGroupLabel.trim();
    if (!trimmed) return;
    onAddGroup(trimmed, [segment.id]);
    setNewGroupLabel("");
    setIsCreatingGroup(false);
  }

  return (
    <div className="absolute top-14 right-4 z-30 w-80 rounded-lg border border-border/80 bg-popover/95 p-4 font-sans text-xs text-popover-foreground shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
            <span>{segment.id}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{lineRangeLabel}</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            Confidence: {Math.round(segment.confidence * 100)}%
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasAnyOverride && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onResetSegmentOverride(segment.id)}
              className="text-muted-foreground hover:text-foreground"
              title="Reset all metrics on this segment to AI values"
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Excerpt */}
      {excerpt && (
        <div className="my-2.5 rounded border border-border/50 bg-muted/30 p-2.5 font-serif text-[11px] text-foreground/90 leading-snug">
          <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground pb-1">
            <span className="uppercase tracking-wider font-semibold">Passage</span>
            {onOpenPassageReader && (
              <button
                type="button"
                onClick={onOpenPassageReader}
                className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors"
                title="Open full passage reader"
              >
                <Maximize2 className="size-2.5" />
                <span>Read</span>
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap">{excerpt}</p>
        </div>
      )}

      {/* Rationale */}
      {segment.rationale && (
        <div className="mb-3 text-[11px] text-muted-foreground/90 leading-relaxed">
          {segment.rationale}
        </div>
      )}

      {/* Metric Overrides Grid */}
      <div className="space-y-2 border-t border-border/40 pt-2.5">
        {/* Intensity */}
        <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
          <span className="text-muted-foreground w-20">Intensity:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/70">
              AI: {segment.intensity}
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={effectiveIntensity}
              onChange={(e) =>
                handleMetricChange("intensity", e.target.value, 0, 10)
              }
              className="h-1.5 w-20 accent-foreground cursor-pointer"
            />
            <span
              className={`w-7 text-right font-bold ${
                currentSegOverride?.intensity !== undefined
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {effectiveIntensity}
            </span>
            {currentSegOverride?.intensity !== undefined && (
              <button
                type="button"
                onClick={() => handleResetMetric("intensity")}
                className="text-muted-foreground hover:text-foreground"
                title="Reset to AI"
              >
                <RotateCcw className="size-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tension */}
        <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
          <span className="text-muted-foreground w-20">Tension:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/70">
              AI: {segment.tension}
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={effectiveTension}
              onChange={(e) =>
                handleMetricChange("tension", e.target.value, 0, 10)
              }
              className="h-1.5 w-20 accent-foreground cursor-pointer"
            />
            <span
              className={`w-7 text-right font-bold ${
                currentSegOverride?.tension !== undefined
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {effectiveTension}
            </span>
            {currentSegOverride?.tension !== undefined && (
              <button
                type="button"
                onClick={() => handleResetMetric("tension")}
                className="text-muted-foreground hover:text-foreground"
                title="Reset to AI"
              >
                <RotateCcw className="size-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Valence */}
        <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
          <span className="text-muted-foreground w-20">Valence:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/70">
              AI: {segment.valence > 0 ? `+${segment.valence}` : segment.valence}
            </span>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.1}
              value={effectiveValence}
              onChange={(e) =>
                handleMetricChange("valence", e.target.value, -10, 10)
              }
              className="h-1.5 w-20 accent-foreground cursor-pointer"
            />
            <span
              className={`w-7 text-right font-bold ${
                currentSegOverride?.valence !== undefined
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {effectiveValence > 0 ? `+${effectiveValence}` : effectiveValence}
            </span>
            {currentSegOverride?.valence !== undefined && (
              <button
                type="button"
                onClick={() => handleResetMetric("valence")}
                className="text-muted-foreground hover:text-foreground"
                title="Reset to AI"
              >
                <RotateCcw className="size-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Temperature */}
        <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
          <span className="text-muted-foreground w-20">Temp:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/70">
              AI: {segment.temperature > 0 ? `+${segment.temperature}` : segment.temperature}
            </span>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.1}
              value={effectiveTemperature}
              onChange={(e) =>
                handleMetricChange("temperature", e.target.value, -10, 10)
              }
              className="h-1.5 w-20 accent-foreground cursor-pointer"
            />
            <span
              className={`w-7 text-right font-bold ${
                currentSegOverride?.temperature !== undefined
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {effectiveTemperature > 0
                ? `+${effectiveTemperature}`
                : effectiveTemperature}
            </span>
            {currentSegOverride?.temperature !== undefined && (
              <button
                type="button"
                onClick={() => handleResetMetric("temperature")}
                className="text-muted-foreground hover:text-foreground"
                title="Reset to AI"
              >
                <RotateCcw className="size-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Groups Section */}
      <div className="mt-3 border-t border-border/40 pt-2.5">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground mb-1.5">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            Segment Groups
          </span>
          <button
            type="button"
            onClick={() => setIsCreatingGroup((prev) => !prev)}
            className="flex items-center gap-0.5 text-[10px] hover:text-foreground"
          >
            <Plus className="size-2.5" />
            New
          </button>
        </div>

        {isCreatingGroup && (
          <form onSubmit={handleCreateGroup} className="flex gap-1.5 my-1.5">
            <Input
              type="text"
              placeholder="Group name (e.g. Descent)..."
              value={newGroupLabel}
              onChange={(e) => setNewGroupLabel(e.target.value)}
              className="h-6 text-[11px] font-mono"
              autoFocus
            />
            <Button type="submit" size="xs" variant="outline" className="h-6 px-2 text-[10px]">
              Add
            </Button>
          </form>
        )}

        {matchingGroups.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {matchingGroups.map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
              >
                {g.label}
                <button
                  type="button"
                  onClick={() => onRemoveGroup(g.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Delete group"
                >
                  <Trash2 className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/60 italic">
            Not assigned to any group.
          </span>
        )}
      </div>
    </div>
  );
}
