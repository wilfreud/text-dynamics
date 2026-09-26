import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { METRIC_DESCRIPTORS, type MetricKind } from "./graphTypes";
import { Flame, Gauge, Heart, Sparkles } from "lucide-react";

interface MetricHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMetric?: MetricKind;
}

interface ExampleItem {
  title: string;
  score: string;
  excerpt: string;
  commentary: string;
  scoreType: "high" | "low" | "neutral";
}

interface MetricGuide {
  kind: MetricKind;
  label: string;
  scaleBadge: string;
  definition: string;
  distinction: string;
  examples: ExampleItem[];
}

const METRIC_GUIDES: Record<MetricKind, MetricGuide> = {
  intensity: {
    kind: "intensity",
    label: "Intensity",
    scaleBadge: "Scale: 0 to 10",
    definition:
      "Perceived force, impact, acoustic weight, or visceral energy. Reflects how loudly, forcefully, or violently the text strikes the reader's sensory imagination.",
    distinction:
      "Intensity measures physical and sensory presence, not suspense. High intensity can accompany a release of tension (e.g. cathartic outcry), while low intensity can occur during extreme suspense.",
    examples: [
      {
        title: "High Intensity",
        score: "8.5 / 10",
        scoreType: "high",
        excerpt: "Et la mer s'effondre en fracas contre les rochers, déchirant la nuit d'un hurlement sans fin !",
        commentary: "Heavy acoustic impact, harsh plosives, violent kinetic verbs, high sensory presence.",
      },
      {
        title: "Low Intensity",
        score: "1.5 / 10",
        scoreType: "low",
        excerpt: "Un grain de poussière retombe sans bruit dans l'ombre du couloir éteint.",
        commentary: "Muffled volume, minimal sensory footprint, delicate stillness, restrained acoustic weight.",
      },
    ],
  },
  tension: {
    kind: "tension",
    label: "Tension",
    scaleBadge: "Scale: 0 to 10",
    definition:
      "Psychological suspense, pressure, unresolved expectancy, or structural friction. Reflects the degree of instability, conflict, and tightness in the passage.",
    distinction:
      "Tension can be maximal in complete silence. A whisper held before an imminent tragedy can exhibit near-maximum tension with very low intensity.",
    examples: [
      {
        title: "High Tension",
        score: "9.0 / 10",
        scoreType: "high",
        excerpt: "Le loquet glisse d'un millimètre. Personne ne respire. La nuit retient son souffle.",
        commentary: "Suspended expectation, claustrophobic pressure, acute anticipation before an irreversible event.",
      },
      {
        title: "Low Tension",
        score: "1.0 / 10",
        scoreType: "low",
        excerpt: "La lumière baisse doucement ; la maison s'endort enfin d'un sommeil réparateur.",
        commentary: "Full resolution of conflict, release of breath, peaceful stability with zero impending pressure.",
      },
    ],
  },
  valence: {
    kind: "valence",
    label: "Valence",
    scaleBadge: "Scale: -10 to +10 (Neutral at 0)",
    definition:
      "Affective polarity and moral-emotional direction, ranging from deep despair/destruction (-10) through neutral observation (0) to radiant joy and transcendence (+10).",
    distinction:
      "Valence reflects the affective color of the emotional state, not its heat. Negative valence can be passionately furious or coldly detached.",
    examples: [
      {
        title: "Positive Valence",
        score: "+8.5 / 10",
        scoreType: "high",
        excerpt: "L'aube dorée inonde les vignes et fait chanter les enfants enfin retrouvés.",
        commentary: "Light, restoration, warmth, moral and spiritual elevation.",
      },
      {
        title: "Negative Valence",
        score: "-8.5 / 10",
        scoreType: "low",
        excerpt: "Rien ne repoussera jamais dans cette terre dévastée, abandonnée aux cendres.",
        commentary: "Despair, grief, irremediable loss, bleak ruin.",
      },
      {
        title: "Neutral Valence",
        score: "0.0 / 10",
        scoreType: "neutral",
        excerpt: "L'horloge de fonte égraine trois coups réguliers dans la salle vide.",
        commentary: "Objective chronological record without moral or emotional bias.",
      },
    ],
  },
  temperature: {
    kind: "temperature",
    label: "Temperature",
    scaleBadge: "Scale: -10 to +10 (Neutral at 0)",
    definition:
      "Affective register of engagement, ranging from clinical detachment, icy irony, and analytical distance (-10) to passionate fervor, bodily heat, and intimate warmth (+10).",
    distinction:
      "Negative temperature denotes emotional distance, cynicism, or surgical observation. Positive temperature denotes heat, fever, sensory intimacy, or raw bodily passion.",
    examples: [
      {
        title: "Warm / Passionate",
        score: "+8.5 / 10",
        scoreType: "high",
        excerpt: "Mon sang palpite comme un brasier ; je brûle d'une fièvre qui dévore mes tempes.",
        commentary: "Sensory fervor, visceral combustion, passionate surrender, immediate presence.",
      },
      {
        title: "Cold / Detached",
        score: "-8.0 / 10",
        scoreType: "low",
        excerpt: "Le rapport d'autopsie mentionne une heure approximative. La procédure a été respectée.",
        commentary: "Clinical distance, bureaucratic detachment, absolute absence of emotional heat.",
      },
    ],
  },
};

export function MetricHelpDialog({
  open,
  onOpenChange,
  initialMetric = "intensity",
}: MetricHelpDialogProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKind>(initialMetric);

  useEffect(() => {
    if (open && initialMetric) {
      setActiveMetric(initialMetric);
    }
  }, [open, initialMetric]);

  const guide = METRIC_GUIDES[activeMetric];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-xl font-sans gap-4 p-6">
        <DialogHeader className="gap-1 border-b border-border/60 pb-3">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
              Dynamic Metrics Reference
            </DialogTitle>
            <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
              {guide.scaleBadge}
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Explore the four orthogonal dynamic dimensions analyzed in literary texts.
          </DialogDescription>
        </DialogHeader>

        {/* Dimension Selection Tabs */}
        <div className="flex items-center gap-1 border-b border-border/50 pb-2">
          {(["intensity", "tension", "valence", "temperature"] as MetricKind[]).map(
            (metricKey) => {
              const isSelected = activeMetric === metricKey;
              const desc = METRIC_DESCRIPTORS[metricKey];
              return (
                <button
                  key={metricKey}
                  type="button"
                  onClick={() => setActiveMetric(metricKey)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  {metricKey === "intensity" && <Sparkles className="size-3" />}
                  {metricKey === "tension" && <Gauge className="size-3" />}
                  {metricKey === "valence" && <Heart className="size-3" />}
                  {metricKey === "temperature" && <Flame className="size-3" />}
                  <span>{desc.label}</span>
                </button>
              );
            }
          )}
        </div>

        {/* Active Metric Description */}
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="space-y-1.5">
            <h4 className="font-mono text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Definition & Analytical Role
            </h4>
            <p className="text-muted-foreground">
              {guide.definition}
            </p>
          </div>

          <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 space-y-1">
            <span className="font-mono text-[10px] font-semibold text-foreground uppercase tracking-wider">
              Key Distinction
            </span>
            <p className="text-[11px] text-muted-foreground">
              {guide.distinction}
            </p>
          </div>

          {/* Literary Examples Section */}
          <div className="space-y-2.5 pt-1">
            <h4 className="font-mono text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Textual Examples
            </h4>
            <div className="grid gap-2.5">
              {guide.examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border/60 bg-card p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-medium text-foreground">{ex.title}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        ex.scoreType === "high"
                          ? "bg-foreground/10 text-foreground"
                          : ex.scoreType === "low"
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {ex.score}
                    </span>
                  </div>
                  <blockquote className="border-l-2 border-border pl-2.5 italic text-foreground/90 font-serif text-xs">
                    "{ex.excerpt}"
                  </blockquote>
                  <p className="text-[11px] text-muted-foreground">
                    {ex.commentary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
