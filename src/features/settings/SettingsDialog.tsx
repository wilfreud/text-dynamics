import React, { useState, useEffect } from "react";
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
} from "./settingsService";
import type { AppSettings } from "./types";
import { KeyRound, Check, Trash2, ShieldCheck, AlertCircle } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved?: () => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  onSettingsSaved,
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>({
    hasApiKey: false,
    modelId: "gemini-3.8-flash",
    customInstruction: "",
    theme: "system",
  });

  const [newApiKey, setNewApiKey] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);
  const [keyErrorMessage, setKeyErrorMessage] = useState<string | null>(null);

  const [modelInput, setModelInput] = useState("gemini-3.8-flash");
  const [instructionInput, setInstructionInput] = useState("");
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  useEffect(() => {
    if (open) {
      void loadCurrentSettings();
    }
  }, [open]);

  async function loadCurrentSettings() {
    try {
      const data = await loadAppSettings();
      setSettings(data);
      setModelInput(data.modelId);
      setInstructionInput(data.customInstruction);
      setNewApiKey("");
      setKeySaveMessage(null);
      setKeyErrorMessage(null);
    } catch {
      // Handled in service logs
    }
  }

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newApiKey.trim()) return;

    setIsSavingKey(true);
    setKeyErrorMessage(null);
    setKeySaveMessage(null);

    try {
      await updateApiKey(newApiKey.trim());
      setNewApiKey("");
      setSettings((prev) => ({ ...prev, hasApiKey: true }));
      setKeySaveMessage("API key saved securely in OS credential store.");
      onSettingsSaved?.();
    } catch (err) {
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
      setSettings((prev) => ({ ...prev, hasApiKey: false }));
      setNewApiKey("");
      setKeySaveMessage("API key removed from OS credential store.");
      onSettingsSaved?.();
    } catch (err) {
      setKeyErrorMessage("Failed to clear API key.");
    } finally {
      setIsSavingKey(false);
    }
  }

  async function handleSaveGeneral() {
    setIsSavingGeneral(true);
    try {
      await saveAppSettings({
        modelId: modelInput.trim() || "gemini-3.8-flash",
        customInstruction: instructionInput.trim(),
      });
      setSettings((prev) => ({
        ...prev,
        modelId: modelInput.trim() || "gemini-3.8-flash",
        customInstruction: instructionInput.trim(),
      }));
      onSettingsSaved?.();
      onOpenChange(false);
    } catch {
      // Logged in service
    } finally {
      setIsSavingGeneral(false);
    }
  }

  return (
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
                {settings.hasApiKey ? (
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                    <ShieldCheck className="size-3 text-foreground" />
                    Key configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
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

          {/* Section: Model Configuration */}
          <div className="space-y-2">
            <label className="block font-medium text-foreground">
              Model Identifier
            </label>
            <Input
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              placeholder="gemini-3.8-flash"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Default is <code className="rounded bg-muted px-1 py-0.5 text-[11px]">gemini-3.8-flash</code>. You can also specify any compatible Gemini model (e.g. <code className="rounded bg-muted px-1 py-0.5 text-[11px]">gemini-2.5-flash</code> or <code className="rounded bg-muted px-1 py-0.5 text-[11px]">gemini-2.5-pro</code>).
            </p>
          </div>

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
  );
}
