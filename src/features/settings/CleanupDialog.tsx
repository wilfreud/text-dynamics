import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  deleteAllLocalData,
  restartApplication,
  quitApplication,
  type CleanupResultDto,
} from "./cleanupService";
import {
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface CleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CleanupStep = "confirm" | "progress" | "result";

export function CleanupDialog({ open, onOpenChange }: CleanupDialogProps) {
  const [step, setStep] = useState<CleanupStep>("confirm");
  const [confirmInput, setConfirmInput] = useState("");
  const [progressMsg, setProgressMsg] = useState("Preparing cleanup...");
  const [result, setResult] = useState<CleanupResultDto | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isQuitting, setIsQuitting] = useState(false);

  // Reset state whenever modal is opened
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && step === "progress") {
      // Don't close while cleanup is executing
      return;
    }
    if (isOpen) {
      setStep("confirm");
      setConfirmInput("");
      setResult(null);
      setProgressMsg("Preparing cleanup...");
    }
    onOpenChange(isOpen);
  };

  const executeCleanup = async () => {
    setStep("progress");
    setProgressMsg("Closing database and releasing connections...");

    try {
      // Slight delay for step visibility
      await new Promise((r) => setTimeout(r, 200));
      setProgressMsg("Removing documents, history, and diagnostic logs...");

      const res = await deleteAllLocalData();
      setProgressMsg("Finalizing local data reset...");
      await new Promise((r) => setTimeout(r, 200));

      setResult(res);
      setStep("result");
    } catch (err: any) {
      setResult({
        database: "failed",
        logs: "failed",
        keychain: "failed",
        cache: "failed",
        preferences: "failed",
        allSucceeded: false,
        errorDetails: err?.message || String(err),
      });
      setStep("result");
    }
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await restartApplication();
    } catch (err) {
      console.error("Failed to restart application:", err);
      setIsRestarting(false);
    }
  };

  const handleQuit = async () => {
    setIsQuitting(true);
    try {
      await quitApplication();
    } catch (err) {
      console.error("Failed to quit application:", err);
      setIsQuitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === "deleted") {
      return (
        <span className="text-emerald-600 dark:text-emerald-400 font-mono text-xs">
          deleted
        </span>
      );
    }
    if (status === "already_missing") {
      return (
        <span className="text-muted-foreground font-mono text-xs">
          already clean
        </span>
      );
    }
    if (status === "failed") {
      return (
        <span className="text-red-500 font-mono text-xs font-semibold">
          failed
        </span>
      );
    }
    return (
      <span className="text-muted-foreground font-mono text-xs">{status}</span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-4 font-sans sm:max-w-lg">
        {step === "confirm" && (
          <>
            <DialogHeader className="gap-1 border-b border-border/60 pb-3">
              <DialogTitle className="text-base font-semibold tracking-tight text-destructive flex items-center gap-2">
                <AlertTriangle className="size-5 shrink-0" />
                <span>Delete All Local Data?</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                This permanently resets Text Dynamics on this Mac.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs leading-relaxed text-foreground">
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 space-y-2">
                <p className="font-semibold text-destructive">
                  This action cannot be undone. It permanently removes:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-foreground/90">
                  <li>All local documents and poetry texts</li>
                  <li>All structural analysis results and user overrides</li>
                  <li>Complete Activity and event history</li>
                  <li>All diagnostic log files</li>
                  <li>Saved Gemini API key from macOS Keychain</li>
                  <li>Local workspace preferences and cache</li>
                </ul>
              </div>

              <p className="text-muted-foreground text-[11px]">
                The Text Dynamics application itself will remain installed. If you also wish to uninstall the app, you can delete Text Dynamics from your Applications folder afterwards.
              </p>

              <div className="space-y-1.5 pt-1">
                <label className="block font-medium text-foreground text-xs">
                  Type <strong className="font-mono text-destructive">DELETE</strong> to confirm:
                </label>
                <Input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono text-xs tracking-wider"
                  autoFocus
                />
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
                variant="destructive"
                size="sm"
                disabled={confirmInput.trim() !== "DELETE"}
                onClick={executeCleanup}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>Delete All Local Data</span>
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "progress" && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="size-8 animate-spin text-foreground/80" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Resetting local data...
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {progressMsg}
              </p>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <>
            <DialogHeader className="gap-1 border-b border-border/60 pb-3">
              <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                {result.allSucceeded ? (
                  <>
                    <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                    <span>All Local Data Deleted</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-5 text-destructive shrink-0" />
                    <span>Partial Cleanup Result</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {result.allSucceeded
                  ? "Text Dynamics local storage has been completely wiped."
                  : "Some local resources could not be deleted."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="divide-y divide-border/40 rounded-md border border-border/60 bg-muted/20 p-2 font-mono">
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">SQLite Database</span>
                  {renderStatusBadge(result.database)}
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Diagnostic Logs</span>
                  {renderStatusBadge(result.logs)}
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Keychain API Key</span>
                  {renderStatusBadge(result.keychain)}
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Local Cache</span>
                  {renderStatusBadge(result.cache)}
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Preferences</span>
                  {renderStatusBadge(result.preferences)}
                </div>
              </div>

              {result.errorDetails && (
                <div className="rounded border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] text-destructive space-y-1">
                  <p className="font-semibold">Error details:</p>
                  <p className="font-mono">{result.errorDetails}</p>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {result.allSucceeded
                  ? "To guarantee clean runtime memory, restart the application or quit now."
                  : "You can retry cleanup or quit the application."}
              </p>
            </div>

            <DialogFooter className="mt-2 border-t border-border/60 pt-3 flex items-center justify-between sm:justify-between w-full">
              {!result.allSucceeded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={executeCleanup}
                  className="gap-1.5"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Retry Deletion</span>
                </Button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleQuit}
                  disabled={isQuitting}
                  className="gap-1.5 font-mono text-xs"
                >
                  <LogOut className="size-3.5" />
                  <span>{isQuitting ? "Quitting..." : "Quit"}</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleRestart}
                  disabled={isRestarting}
                  className="gap-1.5 font-mono text-xs"
                >
                  <RefreshCw className={cn("size-3.5", isRestarting && "animate-spin")} />
                  <span>{isRestarting ? "Restarting..." : "Restart"}</span>
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
