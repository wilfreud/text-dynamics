import { useEffect, useRef } from "react";
import { createScope, animate, type Scope } from "animejs";
import { prefersReducedMotion } from "./graphAnimation";
import { Loader2 } from "lucide-react";

interface GraphScanningOverlayProps {
  modelId?: string;
  width?: number;
}

export function GraphScanningOverlay({
  modelId = "gemini-3.8-flash",
}: GraphScanningOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current || prefersReducedMotion()) return;

    const scope: Scope = createScope({ root: rootRef.current });

    scope.add(() => {
      // Oscilloscope scanning beam traversing across the active SVG graph canvas
      animate(".overlay-scan-laser", {
        translateX: ["0%", "100%"],
        duration: 2600,
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
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-background/25 backdrop-blur-[0.5px] transition-opacity duration-200"
      aria-live="polite"
    >
      {/* Top Floating Telemetry Status Badge */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3.5 py-1 text-xs font-mono text-foreground shadow-xs backdrop-blur-xs">
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        <span>Updating dynamics with {modelId}...</span>
      </div>

      {/* Sweeping Laser Hairline */}
      <div
        className="overlay-scan-laser absolute top-0 bottom-0 w-12 -ml-6"
        style={{ willChange: "transform" }}
      >
        {/* Soft aura */}
        <div className="h-full w-full bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
        {/* Crisp center hairline */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-foreground/30 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
      </div>
    </div>
  );
}
