import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  RotateCcw,
  Bug,
} from "lucide-react";
import { Button } from "./ui/button";
import { getLogger } from "../lib/logging";

const logger = getLogger(["error_boundary"]);

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    logger.error("Uncaught React error in component tree: {error}", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    });
    this.props.onReset?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleCopyError = (): void => {
    const { error, errorInfo } = this.state;
    const errorReport = [
      `=== Text Dynamics Error Report ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
      ``,
      `Error Message:`,
      error?.message || "Unknown error",
      ``,
      `Stack Trace:`,
      error?.stack || "No stack trace available",
      ``,
      `Component Stack:`,
      errorInfo?.componentStack || "No component stack available",
      `==================================`,
    ].join("\n");

    navigator.clipboard.writeText(errorReport);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, copied, showDetails } = this.state;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 select-text">
          <div className="w-full max-w-xl rounded-lg border border-destructive/40 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in-0 zoom-in-95 font-sans">
            {/* Header */}
            <div className="flex items-start gap-3.5 border-b border-border/60 pb-4">
              <div className="rounded-full bg-destructive/10 p-2.5 text-destructive shrink-0">
                <AlertTriangle className="size-6" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
                  <span>Application Error</span>
                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-mono text-destructive uppercase">
                    Crash Prevented
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  An unexpected error occurred in the user interface. You can copy the technical diagnostic report to diagnose or report the issue.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Error details</span>
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="text-[11px] text-foreground hover:underline flex items-center gap-1 font-sans cursor-pointer"
                >
                  <Bug className="size-3" />
                  <span>{showDetails ? "Hide stack trace" : "Show stack trace"}</span>
                </button>
              </label>

              <div className="rounded-md border border-border/80 bg-muted/30 p-3 font-mono text-xs text-destructive space-y-1.5 break-words">
                <div className="font-semibold">{error?.name || "Error"}:</div>
                <div className="text-foreground/90 font-mono text-[11.5px]">
                  {error?.message || "An unknown error was encountered."}
                </div>
              </div>

              {/* Collapsible Stack Trace */}
              {showDetails && (
                <div className="space-y-2 pt-1 animate-in fade-in-0 slide-in-from-top-1">
                  <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 font-mono text-[10.5px] text-muted-foreground max-h-44 overflow-y-auto space-y-2 leading-relaxed">
                    {error?.stack && (
                      <div>
                        <div className="font-semibold text-foreground/80 pb-0.5 text-[10px] uppercase">
                          Stack Trace:
                        </div>
                        <pre className="whitespace-pre-wrap">{error.stack}</pre>
                      </div>
                    )}
                    {errorInfo?.componentStack && (
                      <div>
                        <div className="font-semibold text-foreground/80 pb-0.5 text-[10px] uppercase">
                          Component Tree:
                        </div>
                        <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={this.handleCopyError}
                className="w-full sm:w-auto gap-1.5 font-mono text-xs"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" />
                    <span>Copied Report</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy Error Report</span>
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={this.handleReset}
                  className="gap-1.5 font-mono text-xs"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Try Again</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={this.handleReload}
                  className="gap-1.5 font-mono text-xs"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Reload Window</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
