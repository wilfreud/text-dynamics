import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AnalysisSegment, MovementKind } from "../types";
import type { MetricDescriptor } from "./graphTypes";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  BookOpen,
} from "lucide-react";

interface PassageReaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: AnalysisSegment | null;
  segmentIndex: number;
  totalSegments: number;
  sourcePassage: string;
  unitRangeLabel: string;
  activeMetric: MetricDescriptor;
  effectiveMetricValue: number;
  movementKind?: MovementKind;
  phaseLabel?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
}

export function PassageReaderDialog({
  open,
  onOpenChange,
  segment,
  segmentIndex,
  totalSegments,
  sourcePassage,
  unitRangeLabel,
  activeMetric,
  effectiveMetricValue,
  movementKind,
  phaseLabel,
  hasPrevious,
  hasNext,
  onNavigatePrevious,
  onNavigateNext,
}: PassageReaderDialogProps) {
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Invariant (Section 122): Reset scroll to top whenever navigating to a different segment
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [segmentIndex]);

  // Handle keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Do not intercept if user is typing in an input/textarea or has modifier keys pressed
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }

      // Preserve native text selection navigation
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }

      if (e.key === "ArrowLeft") {
        if (hasPrevious) {
          e.preventDefault();
          onNavigatePrevious();
        }
      } else if (e.key === "ArrowRight") {
        if (hasNext) {
          e.preventDefault();
          onNavigateNext();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasPrevious, hasNext, onNavigatePrevious, onNavigateNext]);

  async function handleCopy() {
    if (!sourcePassage) return;
    try {
      await navigator.clipboard.writeText(sourcePassage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  if (!segment) return null;

  const characterCount = sourcePassage.length;
  const ordinalLabel = `Segment ${segmentIndex + 1} of ${totalSegments}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl w-full font-sans gap-0 p-0 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="gap-1 border-b border-border/60 p-5 pb-4 select-none shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-muted-foreground" />
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                {ordinalLabel}
              </DialogTitle>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
              {segment.id}
            </span>
          </div>

          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 pt-0.5 font-mono">
            <span>{characterCount} {characterCount === 1 ? "char" : "chars"}</span>
            {unitRangeLabel && (
              <>
                <span>•</span>
                <span>Units {unitRangeLabel}</span>
              </>
            )}
            {phaseLabel && (
              <>
                <span>•</span>
                <span className="capitalize">Phase: {phaseLabel}</span>
              </>
            )}
            {movementKind && (
              <>
                <span>•</span>
                <span className="uppercase font-semibold text-foreground/80">
                  {movementKind}
                </span>
              </>
            )}
          </DialogDescription>

          {/* Semantic Interpretation / Rationale if available */}
          {segment.rationale && (
            <p className="mt-2 text-xs italic text-muted-foreground/90 font-serif leading-relaxed border-l-2 border-border/80 pl-2.5">
              {segment.rationale}
            </p>
          )}
        </DialogHeader>

        {/* Full Passage Reading Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto p-6 py-5 select-text focus:outline-none"
          tabIndex={0}
        >
          {sourcePassage ? (
            <div className="max-w-3xl mx-auto w-full">
              <p className="whitespace-pre-wrap font-serif text-[15px] sm:text-[16px] leading-[1.8] text-foreground/95 antialiased selection:bg-muted">
                {sourcePassage}
              </p>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground font-mono">
              Source passage unavailable for this segment range.
            </div>
          )}
        </div>

        {/* Metric Context Strip */}
        <div className="border-t border-border/50 bg-muted/20 px-5 py-2.5 shrink-0 flex items-center justify-between text-xs font-mono select-none">
          <div className="flex items-center gap-4 text-muted-foreground text-[11px]">
            <span
              className={
                activeMetric.kind === "intensity"
                  ? "font-bold text-foreground bg-muted px-1.5 py-0.5 rounded"
                  : ""
              }
            >
              Int: {activeMetric.kind === "intensity" ? effectiveMetricValue : segment.intensity}
            </span>
            <span
              className={
                activeMetric.kind === "tension"
                  ? "font-bold text-foreground bg-muted px-1.5 py-0.5 rounded"
                  : ""
              }
            >
              Ten: {activeMetric.kind === "tension" ? effectiveMetricValue : segment.tension}
            </span>
            <span
              className={
                activeMetric.kind === "valence"
                  ? "font-bold text-foreground bg-muted px-1.5 py-0.5 rounded"
                  : ""
              }
            >
              Val:{" "}
              {activeMetric.kind === "valence"
                ? (effectiveMetricValue > 0 ? `+${effectiveMetricValue}` : effectiveMetricValue)
                : (segment.valence > 0 ? `+${segment.valence}` : segment.valence)}
            </span>
            <span
              className={
                activeMetric.kind === "temperature"
                  ? "font-bold text-foreground bg-muted px-1.5 py-0.5 rounded"
                  : ""
              }
            >
              Temp:{" "}
              {activeMetric.kind === "temperature"
                ? (effectiveMetricValue > 0 ? `+${effectiveMetricValue}` : effectiveMetricValue)
                : (segment.temperature > 0 ? `+${segment.temperature}` : segment.temperature)}
            </span>
          </div>

          <div className="text-[10px] text-muted-foreground">
            Confidence: {Math.round(segment.confidence * 100)}%
          </div>
        </div>

        {/* Navigation & Action Footer */}
        <div className="border-t border-border/60 p-4 px-5 shrink-0 flex items-center justify-between bg-card select-none">
          {/* Copy Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            title="Copy exact passage text"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer font-mono"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-foreground" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>

          {/* Sequential Reading Controls */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground/70 hidden sm:inline mr-1">
              ← / → to navigate
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigatePrevious}
              disabled={!hasPrevious}
              className="h-8 gap-1 text-xs cursor-pointer font-mono"
              aria-label="Previous segment"
              title="Previous segment (ArrowLeft)"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateNext}
              disabled={!hasNext}
              className="h-8 gap-1 text-xs cursor-pointer font-mono"
              aria-label="Next segment"
              title="Next segment (ArrowRight)"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
