import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  updateApiKey,
  clearApiKey,
  loadAppSettings,
  saveAppSettings,
  fetchGeminiModelCatalog,
} from "./settingsService";
import { CleanupDialog } from "./CleanupDialog";
import type { AppSettings, GeminiModelOption, BillingAvailability } from "./types";
import { parseAppError } from "../../lib/errors";
import {
  KeyRound,
  Check,
  Trash2,
  ShieldCheck,
  AlertCircle,
  RotateCw,
  Loader2,
  Cpu,
} from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved?: () => void;
}

function formatTokenLimit(tokens?: number | null): string {
  if (!tokens || tokens <= 0) return "";
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M context`;
  }
  if (tokens >= 1_000) {
    const thousands = Math.round(tokens / 1_000);
    return `${thousands}k context`;
  }
  return `${tokens} tokens`;
}

function getBillingLabel(billing: BillingAvailability): string {
  switch (billing) {
    case "free_tier_available":
      return "Free tier";
    case "paid_only":
      return "Paid only";
    case "unknown":
      return "Unknown";
  }
}

export function SettingsDialog({
  open,
  onOpenChange,
  onSettingsSaved,
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>({
    hasApiKey: false,
    apiKeyStatus: { state: "missing" },
    modelId: "gemini-3.8-flash",
    customInstruction: "",
    theme: "system",
  });

  const [newApiKey, setNewApiKey] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);
  const [keyErrorMessage, setKeyErrorMessage] = useState<string | null>(null);

  // Model catalog state
  const [models, setModels] = useState<GeminiModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  const [modelInput, setModelInput] = useState("gemini-3.8-flash");
  const [instructionInput, setInstructionInput] = useState("");
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);

  // Load catalog using stored API key
  const loadModels = useCallback(async (hasKey: boolean) => {
    if (!hasKey) {
      setModels([]);
      setIsLoadingModels(false);
      setModelLoadError(null);
      return;
    }

    setIsLoadingModels(true);
    setModelLoadError(null);

    try {
      const catalog = await fetchGeminiModelCatalog();
      setModels(catalog);
    } catch (err) {
      const parsed = parseAppError(err);
      setModelLoadError(parsed.message || "Failed to fetch model catalog.");
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    void (async () => {
      try {
        const data = await loadAppSettings();
        if (!isMounted) return;
        setSettings(data);
        setModelInput(data.modelId);
        setInstructionInput(data.customInstruction);
        setNewApiKey("");
        setKeySaveMessage(null);
        setKeyErrorMessage(null);
        if (data.hasApiKey) {
          void loadModels(true);
        }
      } catch {
        // Handled in service logs
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open, loadModels]);

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newApiKey.trim()) return;

    setIsSavingKey(true);
    setKeyErrorMessage(null);
    setKeySaveMessage(null);

    try {
      await updateApiKey(newApiKey.trim());
      setNewApiKey("");
      setSettings((prev) => ({
        ...prev,
        hasApiKey: true,
        apiKeyStatus: { state: "configured" },
      }));
      setKeySaveMessage("API key saved securely in OS credential store.");
      onSettingsSaved?.();
      // Refresh models immediately with the newly stored key
      void loadModels(true);
    } catch {
      setKeyErrorMessage("Failed to save API key to OS credential store.");
    } finally {
      setIsSavingKey(false);
    }
  }

  async function handleClearKey() {
    setIsSavingKey(true);
    setKeyErrorMessage(null);
    setKeySaveMessage(null);

    try {
      await clearApiKey();
      setSettings((prev) => ({
        ...prev,
        hasApiKey: false,
        apiKeyStatus: { state: "missing" },
      }));
      setNewApiKey("");
      setModels([]);
      setKeySaveMessage("API key removed from OS credential store.");
      onSettingsSaved?.();
    } catch {
      setKeyErrorMessage("Failed to clear API key.");
    } finally {
      setIsSavingKey(false);
    }
  }

  async function handleSaveGeneral() {
    setIsSavingGeneral(true);
    setKeyErrorMessage(null);
    try {
      if (newApiKey.trim()) {
        await updateApiKey(newApiKey.trim());
        setNewApiKey("");
        setSettings((prev) => ({ ...prev, hasApiKey: true }));
      }

      const chosenModel = modelInput.trim() || "gemini-3.8-flash";
      await saveAppSettings({
        modelId: chosenModel,
        customInstruction: instructionInput.trim(),
      });
      setSettings((prev) => ({
        ...prev,
        modelId: chosenModel,
        customInstruction: instructionInput.trim(),
      }));
      onSettingsSaved?.();
      onOpenChange(false);
    } catch {
      setKeyErrorMessage("Failed to save settings or API key.");
    } finally {
      setIsSavingGeneral(false);
    }
  }

  // Active selected model descriptor
  const activeSelectedModel = useMemo(() => {
    return models.find((m) => m.id === modelInput) ?? null;
  }, [models, modelInput]);

  const isModelUnavailable = useMemo(() => {
    if (models.length === 0 || isLoadingModels) return false;
    return !models.some((m) => m.id === modelInput);
  }, [models, modelInput, isLoadingModels]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 font-sans sm:max-w-lg">
        <DialogHeader className="gap-1 border-b border-border/60 pb-3">
          <DialogTitle className="text-base font-semibold tracking-tight">
            Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure Gemini provider credentials and structural model parameters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {/* Section: Gemini API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-medium text-foreground">
                <KeyRound className="size-3.5 text-muted-foreground" />
                Gemini API Key
              </label>
              <div className="flex items-center gap-1 text-xs">
                {settings.apiKeyStatus?.state === "configured" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                    <ShieldCheck className="size-3 text-foreground" />
                    Key configured
                  </span>
                ) : settings.apiKeyStatus?.state === "error" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive" title={settings.apiKeyStatus.message}>
                    <AlertCircle className="size-3" />
                    Store error
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    <AlertCircle className="size-3" />
                    Not configured
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Stored exclusively in your OS credential store (Keyring / Keychain). Never saved to the database, logs, or frontend state.
            </p>

            <form onSubmit={handleSaveKey} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={
                    settings.hasApiKey
                      ? "Enter new key to replace existing..."
                      : "Paste Gemini API key (AIza...)"
                  }
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newApiKey.trim() || isSavingKey}
                  variant="outline"
                  className="shrink-0"
                >
                  {isSavingKey ? "Saving..." : "Save Key"}
                </Button>
                {settings.hasApiKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearKey}
                    disabled={isSavingKey}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    title="Remove API key from credential store"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>

              {keySaveMessage && (
                <div className="flex items-center gap-1.5 text-xs text-foreground/80">
                  <Check className="size-3.5 text-foreground" />
                  <span>{keySaveMessage}</span>
                </div>
              )}

              {keyErrorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5" />
                  <span>{keyErrorMessage}</span>
                </div>
              )}
            </form>
          </div>

          <div className="border-t border-border/40" />

          {/* Section: Live Model Catalog Select */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-medium text-foreground">
                <Cpu className="size-3.5 text-muted-foreground" />
                Gemini Model
              </label>

              <div className="flex items-center gap-2">
                {isLoadingModels && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Fetching catalog...
                  </span>
                )}
                {settings.hasApiKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadModels(true)}
                    disabled={isLoadingModels}
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    title="Refresh model catalog from Gemini API"
                  >
                    <RotateCw className={`size-3 ${isLoadingModels ? "animate-spin" : ""}`} />
                    <span className="ml-1 text-[10px]">Refresh</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Select Dropdown */}
            <div className="relative">
              <select
                value={modelInput}
                onChange={(e) => {
                  setModelInput(e.target.value);
                }}
                disabled={!settings.hasApiKey || (models.length === 0 && isLoadingModels)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground shadow-xs transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!settings.hasApiKey ? (
                  <option value="" disabled>
                    API key required to load models
                  </option>
                ) : models.length === 0 && isLoadingModels ? (
                  <option value={modelInput} disabled>
                    {modelInput} (loading catalog...)
                  </option>
                ) : (
                  <>
                    {/* Preserve currently selected model if it is not in the fetched catalog */}
                    {isModelUnavailable && (
                      <option value={modelInput} disabled>
                        {modelInput} (unavailable / not in catalog)
                      </option>
                    )}
                    {models.map((m) => {
                      const billing = getBillingLabel(m.billingAvailability);
                      const context = formatTokenLimit(m.inputTokenLimit);
                      const parts = [m.displayName, billing];
                      if (context) parts.push(context);
                      if (m.thinking) parts.push("thinking");
                      return (
                        <option key={m.id} value={m.id}>
                          {parts.join("  •  ")}
                        </option>
                      );
                    })}
                  </>
                )}
              </select>
            </div>

            {/* Retryable Error Banner on Fetch Failure */}
            {modelLoadError && (
              <div className="flex items-center justify-between rounded border border-border/80 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span className="text-[11px]">{modelLoadError}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadModels(true)}
                  className="h-6 px-2 text-[11px]"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Warning if persisted model is not present in live catalog */}
            {isModelUnavailable && (
              <div className="flex items-center gap-1.5 rounded border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-foreground">
                <AlertCircle className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[11px]">
                  Selected model <code className="font-mono">{modelInput}</code> is not in the live catalog. Please select a returned model before running analysis.
                </span>
              </div>
            )}

            {/* Selected Model Detail Row */}
            {activeSelectedModel && (
              <div className="flex flex-wrap items-center gap-2 rounded border border-border/50 bg-muted/20 px-2.5 py-1.5 text-[11px]">
                <span className="font-mono text-foreground">{activeSelectedModel.id}</span>
                <span className="text-border">|</span>
                <span className="font-medium text-foreground">
                  {getBillingLabel(activeSelectedModel.billingAvailability)}
                </span>
                {activeSelectedModel.inputTokenLimit && (
                  <>
                    <span className="text-border">|</span>
                    <span className="text-muted-foreground">
                      {formatTokenLimit(activeSelectedModel.inputTokenLimit)}
                    </span>
                  </>
                )}
                {activeSelectedModel.thinking && (
                  <>
                    <span className="text-border">|</span>
                    <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-foreground">
                      thinking
                    </span>
                  </>
                )}
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Models are fetched live from <code className="font-mono text-[10px]">models.list</code>. &ldquo;Free tier&rdquo; indicates Google offers a standard free API tier for this model; actual billing depends on your Google Cloud project tier.
            </p>
          </div>

          <div className="border-t border-border/40" />

          {/* Section: Custom Analysis Instruction */}
          <div className="space-y-2">
            <label className="block font-medium text-foreground">
              Custom Analysis Instruction <span className="font-normal text-muted-foreground">(Optional)</span>
            </label>
            <Textarea
              rows={3}
              value={instructionInput}
              onChange={(e) => setInstructionInput(e.target.value)}
              placeholder="e.g. Pay special attention to volta shifts, metric breaks, and acoustic density changes..."
              className="resize-none text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Appended to the structured analysis prompt sent to the model.
            </p>
          </div>

          <div className="border-t border-border/40" />

          {/* Section: Advanced (Local Data Reset) */}
          <div className="space-y-2.5">
            <label className="block font-medium text-foreground text-xs uppercase tracking-wider font-mono text-muted-foreground">
              Advanced
            </label>
            <div className="rounded-md border border-border/80 bg-muted/15 p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Delete All Local Data
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Removing Text Dynamics from Applications does not automatically remove its local data from macOS. Use this option to perform a complete local reset (documents, logs, database, and Keychain credentials).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setIsCleanupOpen(true)}
                  className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-xs gap-1"
                >
                  <Trash2 className="size-3" />
                  <span>Reset Data</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Author & Project Info */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>Text Dynamics v0.1.0</span>
            <span>
              By{" "}
              <a
                href="https://commodore64.dev"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-foreground hover:underline"
              >
                Commodore64
              </a>
            </span>
          </div>
        </div>

        <DialogFooter className="mt-2 border-t border-border/60 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSaveGeneral}
            disabled={isSavingGeneral}
          >
            {isSavingGeneral ? "Saving..." : "Apply & Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Local Data Cleanup Modal rendered at root level, never nested inside DialogContent */}
    <CleanupDialog
      open={isCleanupOpen}
      onOpenChange={setIsCleanupOpen}
    />
  </>
  );
}
