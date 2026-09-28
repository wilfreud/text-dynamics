import { useEffect, useRef, useState } from "react";
import { createScope, animate, stagger, type Scope } from "animejs";
import { prefersReducedMotion } from "./graphAnimation";

import type { AnalysisRetryState } from "../types";

interface GraphAnalyzingStateProps {
  modelId?: string;
  retryState?: AnalysisRetryState | null;
}

const ANALYSIS_STEPS = [
  "Segmenting text into atomic structural units...",
  "Evaluating metric trajectories (intensity, tension, valence)...",
  "Synthesizing dynamic movements & phase arcs...",
  "Generating monotone cubic spline curvature...",
];

export function GraphAnalyzingState({
  modelId = "gemini-3.8-flash",
  retryState = null,
}: GraphAnalyzingStateProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Cycle through descriptive analysis steps for informative editorial feedback
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % ANALYSIS_STEPS.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  // Anime.js lifecycle-safe scope for SVG animations
  useEffect(() => {
    if (!rootRef.current || prefersReducedMotion()) return;

    const scope: Scope = createScope({ root: rootRef.current });

    scope.add(() => {
      // 1. Oscilloscope scanning laser cursor
      animate(".analyzing-scan-cursor", {
        translateX: [0, 480],
        duration: 2400,
        ease: "inOutSine",
        alternate: true,
        loop: true,
      });

      // 2. Primary dynamic waveform draw & undulation
      animate(".analyzing-wave-primary", {
        strokeDashoffset: [700, 0],
        duration: 2600,
        ease: "inOutSine",
        alternate: true,
        loop: true,
      });

      // 3. Expanding radar ripples on inflection nodes
      animate(".analyzing-pulse-ring", {
        scale: [0.8, 2.2],
        opacity: [0.8, 0],
        duration: 1600,
        delay: stagger(360),
        ease: "outQuad",
        loop: true,
      });

      // 4. Activity badge icon drawing cycle
      animate(".analyzing-badge-path", {
        strokeDashoffset: [60, 0],
        duration: 1400,
        ease: "inOutSine",
        alternate: true,
        loop: true,
      });
    });

    return () => {
      try {
        scope.revert();
      } catch {
        // Safe unmount
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="flex h-full w-full flex-col items-center justify-center p-6 text-center select-none bg-background animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg space-y-6">
        {/* Animated Badge Icon */}
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-border/80 bg-muted/20 shadow-xs relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.04] to-transparent pointer-events-none" />
          <svg
            viewBox="0 0 24 24"
            className="size-6 text-foreground stroke-current fill-none stroke-[1.8] stroke-linecap-round stroke-linejoin-round"
            aria-hidden="true"
          >
            <path
              d="M22 12h-4l-3 9L9 3l-3 9H2"
              className="analyzing-badge-path"
              strokeDasharray="60"
            />
          </svg>
        </div>

        {/* Text Status Header or Dynamic Retry Banner */}
        {retryState ? (
          <div className="mx-auto flex max-w-sm flex-col gap-1.5 rounded-md border border-border/80 bg-muted/60 p-3 text-center font-mono text-xs text-foreground shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
                </span>
                {retryState.statusCode === 503 ? "Spike in Demand (503)" : `Server Busy (${retryState.statusCode ?? 503})`}
              </span>
              <span className="rounded bg-background px-2 py-0.5 text-[11px] font-bold border border-border/80">
                Retry {retryState.attempt}/{retryState.maxRetries}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {retryState.isWaiting && retryState.remainingMs > 0 ? (
                <>Next attempt in <strong className="text-foreground tabular-nums">{(retryState.remainingMs / 1000).toFixed(1)}s</strong></>
              ) : (
                <strong className="text-foreground">Dispatching attempt now...</strong>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
              Analyzing Text Dynamics
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground transition-all duration-300 min-h-[1.5rem] font-mono flex items-center justify-center">
              {ANALYSIS_STEPS[currentStepIndex]}
            </p>
          </div>
        )}

        {/* Hero Animated SVG Semantic Graph Canvas */}
        <div className="relative rounded-lg border border-border/80 bg-card p-3 shadow-xs overflow-hidden">
          <svg
            viewBox="0 0 540 180"
            className="w-full h-auto text-foreground stroke-current fill-none block"
            aria-label="Animated dynamic structure graph preview"
          >
            <defs>
              {/* Vertical scanning laser aura gradient */}
              <linearGradient id="scanBeamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
                <stop offset="50%" stopColor="currentColor" stopOpacity="0.08" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Coordinate Grid (Dashed horizontal and vertical reference lines) */}
            <g className="text-border/60 stroke-current stroke-dasharray-[2,4] stroke-[0.8]">
              {/* Horizontal level lines */}
              <line x1="30" y1="45" x2="510" y2="45" />
              <line x1="30" y1="90" x2="510" y2="90" />
              <line x1="30" y1="135" x2="510" y2="135" />

              {/* Vertical cadence ticks */}
              <line x1="90" y1="20" x2="90" y2="160" />
              <line x1="180" y1="20" x2="180" y2="160" />
              <line x1="270" y1="20" x2="270" y2="160" />
              <line x1="360" y1="20" x2="360" y2="160" />
              <line x1="450" y1="20" x2="450" y2="160" />
            </g>

            {/* Ghost Background Reference Curve */}
            <path
              d="M 30,110 C 90,40 150,40 210,95 C 270,145 330,145 390,65 C 430,20 470,25 510,50"
              className="text-muted-foreground/20 stroke-current stroke-[1.2] stroke-dasharray-[3,3]"
            />

            {/* Primary Animated Monotone Dynamic Curve */}
            <path
              d="M 30,110 C 90,40 150,40 210,95 C 270,145 330,145 390,65 C 430,20 470,25 510,50"
              className="analyzing-wave-primary text-foreground stroke-current stroke-[1.8] stroke-linecap-round"
              strokeDasharray="700"
            />

            {/* Moving Scanning Laser Beam */}
            <g className="analyzing-scan-cursor text-foreground">
              {/* Soft vertical glow aura */}
              <rect
                x="15"
                y="15"
                width="30"
                height="150"
                fill="url(#scanBeamGradient)"
                stroke="none"
              />
              {/* Crisp vertical hairline cursor */}
              <line
                x1="30"
                y1="18"
                x2="30"
                y2="162"
                stroke="currentColor"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
            </g>

            {/* Inflection Nodes with Expanding Radar Rings */}
            {[
              { x: 30, y: 110, id: "n1" },
              { x: 150, y: 48, id: "n2" },
              { x: 270, y: 120, id: "n3" },
              { x: 390, y: 65, id: "n4" },
              { x: 510, y: 50, id: "n5" },
            ].map((node) => (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                {/* Concentric expanding pulse ring */}
                <circle
                  r="7"
                  className="analyzing-pulse-ring text-foreground stroke-current"
                  fill="none"
                  strokeWidth="1"
                  opacity="0.6"
                  style={{ transformOrigin: "0px 0px" }}
                />
                {/* Core node dot */}
                <circle
                  r="3.5"
                  className="fill-background text-foreground stroke-current"
                  strokeWidth="1.6"
                />
              </g>
            ))}

            {/* Telemetry Corner Labels */}
            <text
              x="32"
              y="16"
              className="fill-muted-foreground/60 text-[8.5px] font-mono uppercase tracking-wider"
              stroke="none"
            >
              {retryState ? `[RETRY: ${retryState.attempt}/${retryState.maxRetries}]` : "[SCAN: ACTIVE]"}
            </text>
            <text
              x="508"
              y="16"
              textAnchor="end"
              className="fill-muted-foreground/60 text-[8.5px] font-mono tracking-wider"
              stroke="none"
            >
              {retryState && retryState.isWaiting && retryState.remainingMs > 0
                ? `T-${(retryState.remainingMs / 1000).toFixed(1)}S`
                : "λ: DYNAMICS_GRAPH"}
            </text>
          </svg>
        </div>

        {/* Footer Technical Metadata */}
        <div className="pt-1">
          <span className="font-mono text-[11px] text-muted-foreground/70">
            Provider: {modelId} • Custom SVG Semantic Graph
          </span>
        </div>
      </div>
    </div>
  );
}
