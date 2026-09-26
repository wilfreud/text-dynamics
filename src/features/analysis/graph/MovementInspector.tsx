import type { AnalysisMovement, MovementKind, UserOverrides } from "../types";
import { Button } from "../../../components/ui/button";
import { X, RotateCcw, Activity } from "lucide-react";

const ALLOWED_MOVEMENT_KINDS: MovementKind[] = [
  "crescendo",
  "decrescendo",
  "spike",
  "drop",
  "plateau",
  "oscillation",
  "rupture",
  "reversal",
  "reset",
  "sustain",
];

interface MovementInspectorProps {
  movement: AnalysisMovement;
  overrides?: UserOverrides;
  onUpdateMovementOverride: (movementId: string, newKind: MovementKind) => void;
  onResetMovementOverride: (movementId: string) => void;
  onClose: () => void;
}

export function MovementInspector({
  movement,
  overrides,
  onUpdateMovementOverride,
  onResetMovementOverride,
  onClose,
}: MovementInspectorProps) {
  const currentMovOverride = overrides?.movementOverrides[movement.id];
  const effectiveKind = currentMovOverride?.kind ?? movement.kind;
  const isOverridden = currentMovOverride?.kind !== undefined;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-80 rounded-lg border border-border/80 bg-popover/95 p-4 font-sans text-xs text-popover-foreground shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
          <Activity className="size-3.5" />
          <span>{movement.id}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            {movement.startSegmentId} → {movement.endSegmentId}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isOverridden && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onResetMovementOverride(movement.id)}
              className="text-muted-foreground hover:text-foreground"
              title="Reset movement to AI kind"
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

      {/* Movement Metadata */}
      <div className="my-2.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>Magnitude: {movement.magnitude}</span>
        <span>Confidence: {Math.round(movement.confidence * 100)}%</span>
        <span>AI Kind: {movement.kind}</span>
      </div>

      {/* Rationale */}
      {movement.rationale && (
        <div className="mb-3 rounded bg-muted/40 p-2 text-[11px] text-muted-foreground leading-relaxed italic">
          "{movement.rationale}"
        </div>
      )}

      {/* Movement Kind Selector */}
      <div className="space-y-1.5 border-t border-border/40 pt-2.5">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[11px] font-medium text-foreground">
            Movement Semantic Kind:
          </label>
          {isOverridden && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
              User Override
            </span>
          )}
        </div>

        <select
          value={effectiveKind}
          onChange={(e) =>
            onUpdateMovementOverride(movement.id, e.target.value as MovementKind)
          }
          className="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-ring"
        >
          {ALLOWED_MOVEMENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind} {kind === movement.kind ? "(AI default)" : ""}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground font-mono">
          Altering this modifies path interpolation geometry immediately without re-calling Gemini.
        </p>
      </div>
    </div>
  );
}
