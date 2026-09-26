import type { ParsedAppError } from "../lib/errors";
import type { ApiKeyStatus } from "../features/settings/types";
import { AlertCircle, CheckCircle2, KeyRound, X } from "lucide-react";
import { Button } from "./ui/button";

interface StatusBarProps {
  isSaving: boolean;
  isDirty: boolean;
  charCount: number;
  lineCount: number;
  modelId: string;
  hasApiKey: boolean;
  apiKeyStatus?: ApiKeyStatus;
  onOpenSettings: () => void;
  activeError: ParsedAppError | null;
  onDismissError: () => void;
}

export function StatusBar({
  isSaving,
  isDirty,
  charCount,
  lineCount,
  modelId,
  hasApiKey,
  apiKeyStatus,
  onOpenSettings,
  activeError,
  onDismissError,
}: StatusBarProps) {
  return (
    <footer className="flex flex-col border-t border-border/80 bg-card select-none">
      {/* Optional Compact Error Notice */}
      {activeError && (
        <div className="flex items-center justify-between border-b border-border/60 bg-destructive/10 px-4 py-1.5 text-xs text-destructive animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="font-semibold">{activeError.title}:</span>
            <span>{activeError.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {activeError.isActionableApiKey && (
              <Button
                variant="outline"
                size="xs"
                onClick={onOpenSettings}
                className="h-5 border-destructive/30 bg-background px-2 text-[11px] text-destructive hover:bg-destructive/10"
              >
                Open Settings
              </Button>
            )}
            <button
              type="button"
              onClick={onDismissError}
              className="text-destructive/70 hover:text-destructive"
              title="Dismiss error"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Status Strip */}
      <div className="flex h-7 items-center justify-between px-3 text-[11px] font-mono text-muted-foreground">
        {/* Left: Save Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isSaving ? (
              <span>Saving...</span>
            ) : isDirty ? (
              <span className="text-foreground/80">Unsaved changes</span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="size-3 text-muted-foreground/70" />
                Saved
              </span>
            )}
          </div>
          <span>•</span>
          <span>
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
          <span>•</span>
          <span>{charCount} chars</span>
        </div>

        {/* Right: Model & Key Indicator */}
        <div className="flex items-center gap-3">
          <span title="Configured model identifier">{modelId}</span>
          <span>•</span>
          {apiKeyStatus?.state === "error" ? (
            <span
              onClick={onOpenSettings}
              className="flex cursor-pointer items-center gap-1 text-destructive hover:underline"
              title={`Credential store error: ${apiKeyStatus.message}`}
            >
              <AlertCircle className="size-3" />
              Keychain Error
            </span>
          ) : hasApiKey ? (
            <span
              onClick={onOpenSettings}
              className="flex cursor-pointer items-center gap-1 text-foreground/80 hover:text-foreground"
              title="Gemini API Key configured in OS credential store"
            >
              <KeyRound className="size-3" />
              API Key Configured
            </span>
          ) : (
            <span
              onClick={onOpenSettings}
              className="flex cursor-pointer items-center gap-1 text-destructive hover:underline"
              title="Click to configure Gemini API Key"
            >
              <AlertCircle className="size-3" />
              Missing API Key
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
