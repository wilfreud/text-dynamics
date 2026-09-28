import { useState } from "react";
import type {
  AnalysisSegment,
  SegmentOverride,
  UserOverrides,
} from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { createPassagePreview } from "../passage/passagePreview";
import {
  X,
  RotateCcw,
  Users,
  Plus,
  Trash2,
  Maximize2,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react";

interface SegmentInspectorProps {
  segment: AnalysisSegment;
  excerpt: string;
  sourcePassage?: string;
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
  sourcePassage,
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

  const rawPassage = sourcePassage || excerpt;
  const preview = createPassagePreview(rawPassage, {
    fullThreshold: 200,
    headTarget: 100,
    tailTarget: 75,
  });

  return (
    <div className="flex flex-col h-full w-full bg-card p-4 overflow-y-auto select-none font-sans text-xs text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
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
              className="text-muted-foreground hover:text-foreground cursor-pointer"
              title="Reset all metrics on this segment to AI values"
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            title="Fermer l'inspecteur"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs: Passage & Métriques */}
      <Tabs defaultValue="passage" className="w-full mt-2.5">
        <TabsList className="grid w-full grid-cols-2 h-7 bg-muted/60 p-0.5">
          <TabsTrigger
            value="passage"
            className="flex items-center justify-center gap-1.5 text-[11px] font-medium h-6 cursor-pointer"
          >
            <BookOpen className="size-3" />
            <span>Passage</span>
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
            className="flex items-center justify-center gap-1.5 text-[11px] font-medium h-6 cursor-pointer"
          >
            <SlidersHorizontal className="size-3" />
            <span>Métriques</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Passage */}
        <TabsContent value="passage" className="mt-3 space-y-3 focus-visible:outline-none">
          {/* Excerpt / Preview Card */}
          {rawPassage ? (
            <div className="rounded border border-border/60 bg-muted/30 p-2.5">
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground pb-1 mb-1 border-b border-border/30">
                <span className="uppercase tracking-wider font-semibold">Extrait source</span>
                {preview.kind === "head-tail" && (
                  <span>{rawPassage.length} chars</span>
                )}
              </div>

              {preview.kind === "head-tail" ? (
                <div className="whitespace-pre-wrap font-serif text-[11px] leading-relaxed text-foreground/90">
                  <p>{preview.head}</p>
                  <div className="my-1.5 flex items-center justify-center gap-1 font-mono text-[9px] text-muted-foreground/60 select-none">
                    <span>⋯</span>
                    <span>{preview.omittedCharacterCount} caractères omis</span>
                    <span>⋯</span>
                  </div>
                  <p>{preview.tail}</p>
                </div>
              ) : (
                <p className="whitespace-pre-wrap font-serif text-[11px] leading-relaxed text-foreground/90">
                  {preview.text}
                </p>
              )}

              {onOpenPassageReader && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenPassageReader}
                  className="w-full mt-2.5 h-6.5 text-[10px] font-mono flex items-center justify-center gap-1.5 cursor-pointer hover:bg-accent"
                >
                  <Maximize2 className="size-3" />
                  <span>Ouvrir dans le lecteur</span>
                </Button>
              )}
            </div>
          ) : null}

          {/* Rationale / Interpretation */}
          {segment.rationale && (
            <div className="rounded border-l-2 border-border/80 bg-muted/20 pl-2.5 py-1 text-[11px] italic font-serif text-muted-foreground leading-relaxed">
              {segment.rationale}
            </div>
          )}

          {/* Metric Summary Strip */}
          <div className="grid grid-cols-4 gap-1 pt-1 font-mono text-[10px] text-center">
            <div className="bg-muted/40 rounded p-1">
              <div className="text-muted-foreground text-[9px]">Int</div>
              <div className="font-semibold text-foreground">{effectiveIntensity}</div>
            </div>
            <div className="bg-muted/40 rounded p-1">
              <div className="text-muted-foreground text-[9px]">Ten</div>
              <div className="font-semibold text-foreground">{effectiveTension}</div>
            </div>
            <div className="bg-muted/40 rounded p-1">
              <div className="text-muted-foreground text-[9px]">Val</div>
              <div className="font-semibold text-foreground">
                {effectiveValence > 0 ? `+${effectiveValence}` : effectiveValence}
              </div>
            </div>
            <div className="bg-muted/40 rounded p-1">
              <div className="text-muted-foreground text-[9px]">Temp</div>
              <div className="font-semibold text-foreground">
                {effectiveTemperature > 0 ? `+${effectiveTemperature}` : effectiveTemperature}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Métriques & Ajustements */}
        <TabsContent value="metrics" className="mt-3 space-y-2.5 focus-visible:outline-none">
          <div className="space-y-2 pt-1">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
