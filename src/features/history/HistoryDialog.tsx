import React, { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  fetchActivityEvents,
  fetchSessions,
  fetchCurrentSessionId,
  fetchDiagnosticLogs,
  openLogsFolder,
  clearActivityHistory,
  clearDiagnosticLogs,
  formatFriendlyDate,
  formatEventTime,
} from "./historyService";
import type {
  ActivityEventDto,
  DiagnosticLogEntryDto,
  SessionSummaryDto,
  HistoryTab,
} from "./types";
import {
  Search,
  FolderOpen,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Terminal,
  Activity,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDocumentId?: string | null;
  currentDocumentTitle?: string | null;
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim() || !text) {
    return <>{text}</>;
  }
  try {
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark
              key={i}
              className="bg-amber-400/35 text-foreground rounded-xs px-0.5 font-medium"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}

export function HistoryDialog({
  open,
  onOpenChange,
  currentDocumentId = null,
  currentDocumentTitle = null,
}: HistoryDialogProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>("activity");

  // Filter States
  const [query, setQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("current");
  const [selectedDocId, setSelectedDocId] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Sessions
  const [sessions, setSessions] = useState<SessionSummaryDto[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  // Activity Events State
  const [activityEvents, setActivityEvents] = useState<ActivityEventDto[]>([]);
  const [activityTotalCount, setActivityTotalCount] = useState(0);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityOffset, setActivityOffset] = useState(0);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [expandedActivityIds, setExpandedActivityIds] = useState<Set<string>>(new Set());

  // Diagnostics Logs State
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLogEntryDto[]>([]);
  const [diagnosticsTotalCount, setDiagnosticsTotalCount] = useState(0);
  const [diagnosticsHasMore, setDiagnosticsHasMore] = useState(false);
  const [diagnosticsOffset, setDiagnosticsOffset] = useState(0);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Action status feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load Sessions
  const loadSessions = useCallback(async () => {
    try {
      const [sessList, currId] = await Promise.all([
        fetchSessions(),
        fetchCurrentSessionId(),
      ]);
      setSessions(sessList);
      setCurrentSessionId(currId);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }, []);

  // Load Activity Events
  const loadActivity = useCallback(
    async (offset = 0, append = false) => {
      setIsLoadingActivity(true);
      try {
        const resolvedSessionId =
          selectedSessionId === "current"
            ? currentSessionId || undefined
            : selectedSessionId === "all"
            ? undefined
            : selectedSessionId;

        const resolvedDocId =
          selectedDocId === "current"
            ? currentDocumentId || undefined
            : selectedDocId === "none"
            ? ""
            : selectedDocId === "all"
            ? undefined
            : selectedDocId;

        const res = await fetchActivityEvents({
          query: query.trim() || undefined,
          sessionId: resolvedSessionId,
          documentId: resolvedDocId,
          level: selectedLevel !== "all" ? selectedLevel : undefined,
          category: selectedCategory !== "all" ? selectedCategory : undefined,
          limit: 100,
          offset,
        });

        if (append) {
          setActivityEvents((prev) => [...prev, ...res.events]);
        } else {
          setActivityEvents(res.events);
        }
        setActivityTotalCount(res.totalCount);
        setActivityHasMore(res.hasMore);
        setActivityOffset(offset);
      } catch (err) {
        console.error("Failed to load activity events:", err);
      } finally {
        setIsLoadingActivity(false);
      }
    },
    [
      selectedSessionId,
      currentSessionId,
      selectedDocId,
      currentDocumentId,
      selectedLevel,
      selectedCategory,
      query,
    ]
  );

  // Load Diagnostic Logs
  const loadDiagnostics = useCallback(
    async (offset = 0, append = false) => {
      setIsLoadingDiagnostics(true);
      try {
        const resolvedSessionId =
          selectedSessionId === "current"
            ? currentSessionId || undefined
            : selectedSessionId === "all"
            ? undefined
            : selectedSessionId;

        const res = await fetchDiagnosticLogs({
          query: query.trim() || undefined,
          sessionId: resolvedSessionId,
          documentId: selectedDocId === "current" ? currentDocumentId || undefined : undefined,
          level: selectedLevel !== "all" ? selectedLevel.toUpperCase() : undefined,
          limit: 100,
          offset,
        });

        if (append) {
          setDiagnosticLogs((prev) => [...prev, ...res.entries]);
        } else {
          setDiagnosticLogs(res.entries);
        }
        setDiagnosticsTotalCount(res.totalCount);
        setDiagnosticsHasMore(res.hasMore);
        setDiagnosticsOffset(offset);
      } catch (err) {
        console.error("Failed to load diagnostic logs:", err);
      } finally {
        setIsLoadingDiagnostics(false);
      }
    },
    [selectedSessionId, currentSessionId, selectedDocId, currentDocumentId, selectedLevel, query]
  );

  // Refresh current view
  const refresh = useCallback(() => {
    loadSessions();
    if (activeTab === "activity") {
      loadActivity(0, false);
    } else {
      loadDiagnostics(0, false);
    }
  }, [activeTab, loadSessions, loadActivity, loadDiagnostics]);

  // Initial load when dialog opens or active filters/tab change
  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open, loadSessions]);

  useEffect(() => {
    if (open) {
      if (activeTab === "activity") {
        loadActivity(0, false);
      } else {
        loadDiagnostics(0, false);
      }
    }
  }, [open, activeTab, loadActivity, loadDiagnostics]);

  // Live updates: listen to "activity:created"
  useEffect(() => {
    if (!open) return;
    let unlisten: (() => void) | undefined;
    listen<ActivityEventDto>("activity:created", (event) => {
      // Check if new event matches active session filter
      if (
        selectedSessionId === "current" &&
        currentSessionId &&
        event.payload.sessionId !== currentSessionId
      ) {
        return;
      }
      if (
        selectedSessionId !== "all" &&
        selectedSessionId !== "current" &&
        event.payload.sessionId !== selectedSessionId
      ) {
        return;
      }
      // Prepend to current activity list if it matches
      setActivityEvents((prev) => [event.payload, ...prev]);
      setActivityTotalCount((prev) => prev + 1);
    })
      .then((unsub) => {
        unlisten = unsub;
      })
      .catch((e) => console.error("Failed to listen to activity:created:", e));

    return () => {
      if (unlisten) unlisten();
    };
  }, [open, selectedSessionId, currentSessionId]);

  // Toggle expansion of activity event
  const toggleActivityExpand = (id: string) => {
    setExpandedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle expansion of diagnostic log entry
  const toggleLogExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Open Logs Folder in Finder
  const handleOpenFolder = async () => {
    try {
      await openLogsFolder();
      setActionMessage("Opened logs folder");
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err) {
      console.error("Failed to open logs folder:", err);
    }
  };

  // Clear Activity
  const handleClearActivity = async () => {
    if (!window.confirm("Are you sure you want to clear all activity history? This cannot be undone.")) {
      return;
    }
    try {
      await clearActivityHistory();
      setActivityEvents([]);
      setActivityTotalCount(0);
      setActivityHasMore(false);
      setActionMessage("Activity history cleared");
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err) {
      console.error("Failed to clear activity:", err);
    }
  };

  // Clear Diagnostic Logs
  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to delete all diagnostic log files?")) {
      return;
    }
    try {
      await clearDiagnosticLogs();
      setDiagnosticLogs([]);
      setDiagnosticsTotalCount(0);
      setDiagnosticsHasMore(false);
      setActionMessage("Diagnostic logs cleared");
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  // Render Level Badge
  const renderLevelBadge = (level: string) => {
    const norm = level.toLowerCase();
    let badgeClass = "bg-muted text-muted-foreground border-border";
    if (norm === "error") {
      badgeClass = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    } else if (norm === "warn" || norm === "warning") {
      badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    } else if (norm === "info") {
      badgeClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    }

    return (
      <span
        className={cn(
          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold border",
          badgeClass
        )}
      >
        {level}
      </span>
    );
  };

  // Parse Metadata inline pills
  const renderMetadataPills = (metaStr: string | null) => {
    if (!metaStr) return null;
    try {
      const parsed = JSON.parse(metaStr);
      const pills: React.ReactNode[] = [];

      if (parsed.model) {
        pills.push(
          <span key="model" className="text-muted-foreground font-mono text-[11px]">
            {parsed.model}
          </span>
        );
      }
      if (parsed.durationMs !== undefined) {
        pills.push(
          <span key="dur" className="text-muted-foreground font-mono text-[11px]">
            {(parsed.durationMs / 1000).toFixed(2)}s
          </span>
        );
      }
      if (parsed.contentChars !== undefined) {
        pills.push(
          <span key="chars" className="text-muted-foreground font-mono text-[11px]">
            {parsed.contentChars} chars
          </span>
        );
      }
      if (parsed.attempt !== undefined) {
        pills.push(
          <span key="attempt" className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">
            attempt {parsed.attempt}/{parsed.maxRetries || 4}
          </span>
        );
      }
      if (parsed.error) {
        pills.push(
          <span key="err" className="text-red-500 font-mono text-[11px] truncate max-w-[200px]">
            {String(parsed.error)}
          </span>
        );
      }

      if (pills.length === 0) return null;

      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          {pills.map((p, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-muted-foreground/40 text-xs">·</span>}
              {p}
            </React.Fragment>
          ))}
        </div>
      );
    } catch {
      return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden font-sans border-border/80 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/70 flex flex-row items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="size-4 text-foreground/80" />
              <span>History & Diagnostics</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              User activity log and runtime technical diagnostics
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 pr-6">
            {actionMessage && (
              <span className="text-xs text-muted-foreground animate-fade-in font-mono">
                {actionMessage}
              </span>
            )}
            <Button
              variant="outline"
              size="xs"
              onClick={refresh}
              disabled={isLoadingActivity || isLoadingDiagnostics}
              className="gap-1 font-mono text-xs"
              title="Refresh"
            >
              <RefreshCw
                className={cn("size-3", (isLoadingActivity || isLoadingDiagnostics) && "animate-spin")}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Tab Selector & Controls */}
        <div className="p-3 border-b border-border/60 bg-muted/20 flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as HistoryTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="activity" className="gap-1.5 text-xs">
                  <Activity className="size-3.5" />
                  <span>Activity ({activityTotalCount})</span>
                </TabsTrigger>
                <TabsTrigger value="diagnostics" className="gap-1.5 text-xs">
                  <Terminal className="size-3.5" />
                  <span>Diagnostics ({diagnosticsTotalCount})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Right Tab-Specific Actions */}
            <div className="flex items-center gap-2">
              {activeTab === "diagnostics" && (
                <>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleOpenFolder}
                    className="gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                    title="Open Logs Folder in Finder"
                  >
                    <FolderOpen className="size-3.5" />
                    <span>Open Logs Folder</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleClearLogs}
                    className="gap-1 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                    title="Clear Log Files"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Clear Logs</span>
                  </Button>
                </>
              )}
              {activeTab === "activity" && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleClearActivity}
                  className="gap-1 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                  title="Clear Activity Events History"
                >
                  <Trash2 className="size-3.5" />
                  <span>Clear History</span>
                </Button>
              )}
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            {/* Search Input */}
            <div className="md:col-span-3 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search event, message..."
                className="h-8 pl-8 pr-2.5 text-xs font-mono bg-background"
              />
            </div>

            {/* Session Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-sans text-foreground outline-none focus:border-ring"
              >
                <option value="current">Current session</option>
                <option value="all">All sessions</option>
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.isCurrent
                      ? `Current (${formatFriendlyDate(s.firstEventAt)})`
                      : `${formatFriendlyDate(s.firstEventAt)} (${s.eventCount} events)`}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Filter (for Activity & Diagnostics) */}
            <div className="md:col-span-2">
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-sans text-foreground outline-none focus:border-ring"
              >
                <option value="all">All documents</option>
                {currentDocumentId && (
                  <option value="current">
                    Current: {currentDocumentTitle || "Untitled"}
                  </option>
                )}
                {activeTab === "activity" && (
                  <option value="none">App-level</option>
                )}
              </select>
            </div>

            {/* Level Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-sans text-foreground outline-none focus:border-ring"
              >
                <option value="all">All levels</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-sans text-foreground outline-none focus:border-ring"
              >
                <option value="all">All categories</option>
                <option value="app">app</option>
                <option value="document">document</option>
                <option value="analysis">analysis</option>
                <option value="settings">settings</option>
                <option value="security">security</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto min-h-[360px] max-h-[58vh] divide-y divide-border/40 bg-background/50">
          {activeTab === "activity" ? (
            // Activity Events List
            activityEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Activity className="size-8 stroke-[1.5] mb-2 opacity-40" />
                <p className="text-sm font-medium">No activity events found</p>
                <p className="text-xs text-muted-foreground/75 mt-0.5">
                  Try adjusting your search terms or filters
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 font-sans">
                {activityEvents.map((event) => {
                  const isExpanded = expandedActivityIds.has(event.id);
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "group transition-colors hover:bg-muted/30 text-xs",
                        isExpanded && "bg-muted/20"
                      )}
                    >
                      {/* Row Header */}
                      <div
                        onClick={() => toggleActivityExpand(event.id)}
                        className="flex items-start gap-3 p-3 cursor-pointer select-none"
                      >
                        <div className="pt-0.5 text-muted-foreground/60 shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="font-mono text-muted-foreground text-[11px] shrink-0 pt-0.5 w-16">
                          {formatEventTime(event.createdAt)}
                        </div>

                        {/* Level */}
                        <div className="shrink-0">{renderLevelBadge(event.level)}</div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-medium text-foreground text-xs">
                              <HighlightedText text={event.eventName} query={query} />
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 uppercase font-mono px-1 border border-border/60 rounded">
                              {event.category}
                            </span>
                            {event.documentId && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                doc:{" "}
                                {currentDocumentId === event.documentId
                                  ? currentDocumentTitle || "current"
                                  : event.documentId.slice(0, 10) + "..."}
                              </span>
                            )}
                          </div>

                          {event.message && (
                            <p className="text-xs text-foreground/90 font-sans">
                              <HighlightedText text={event.message} query={query} />
                            </p>
                          )}

                          {/* Metadata chips */}
                          {renderMetadataPills(event.metadataJson)}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-10 pb-3 pt-1 space-y-2.5 border-t border-border/20 bg-muted/10 font-mono text-[11px]">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-muted-foreground">
                            <div>
                              <span className="text-muted-foreground/60 block text-[10px] uppercase">
                                Event ID
                              </span>
                              <span className="text-foreground">{event.id}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block text-[10px] uppercase">
                                Session
                              </span>
                              <span className="text-foreground truncate block" title={event.sessionId}>
                                {event.sessionId}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block text-[10px] uppercase">
                                Timestamp UTC
                              </span>
                              <span className="text-foreground">{event.createdAt}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block text-[10px] uppercase">
                                Document
                              </span>
                              <span className="text-foreground">
                                {event.documentId || "None (App-level)"}
                              </span>
                            </div>
                          </div>

                          {/* Formatted JSON Metadata */}
                          {event.metadataJson && (
                            <div className="relative mt-2">
                              <div className="flex items-center justify-between pb-1 text-[10px] text-muted-foreground uppercase font-sans">
                                <span>Metadata</span>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(event.metadataJson!, event.id);
                                  }}
                                  className="h-5 px-1 text-[10px] gap-1"
                                >
                                  {copiedId === event.id ? (
                                    <>
                                      <Check className="size-2.5 text-emerald-500" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-2.5" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                              <pre className="p-2 rounded bg-card border border-border/60 overflow-x-auto text-[11px] text-foreground/90 whitespace-pre-wrap">
                                {(() => {
                                  try {
                                    return JSON.stringify(
                                      JSON.parse(event.metadataJson),
                                      null,
                                      2
                                    );
                                  } catch {
                                    return event.metadataJson;
                                  }
                                })()}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Load More Button */}
                {activityHasMore && (
                  <div className="p-3 text-center">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => loadActivity(activityOffset + 100, true)}
                      disabled={isLoadingActivity}
                      className="font-mono text-xs"
                    >
                      {isLoadingActivity ? "Loading..." : "Load More Events"}
                    </Button>
                  </div>
                )}
              </div>
            )
          ) : (
            // Diagnostics Log Entries
            diagnosticLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Terminal className="size-8 stroke-[1.5] mb-2 opacity-40" />
                <p className="text-sm font-medium">No diagnostic logs found</p>
                <p className="text-xs text-muted-foreground/75 mt-0.5">
                  Try adjusting your search terms or filters
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 font-mono text-[11px]">
                {diagnosticLogs.map((log) => {
                  const isExpanded = expandedLogIds.has(log.id);
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "group transition-colors hover:bg-muted/30 p-2.5 space-y-1",
                        isExpanded && "bg-muted/20"
                      )}
                    >
                      <div
                        onClick={() => toggleLogExpand(log.id)}
                        className="flex items-start gap-2.5 cursor-pointer select-none"
                      >
                        <div className="text-muted-foreground/50 pt-0.5 shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronRight className="size-3" />
                          )}
                        </div>

                        {/* Timestamp */}
                        <span className="text-muted-foreground shrink-0 text-[10.5px]">
                          {log.timestamp ? formatEventTime(log.timestamp) : "--:--:--"}
                        </span>

                        {/* Level */}
                        <div className="shrink-0">{renderLevelBadge(log.level)}</div>

                        {/* Component */}
                        {log.component && (
                          <span className="text-muted-foreground/80 font-semibold shrink-0">
                            [{log.component}]
                          </span>
                        )}

                        {/* Message with highlighting */}
                        <div className="flex-1 min-w-0 text-foreground break-words">
                          <HighlightedText text={log.message} query={query} />
                        </div>
                      </div>

                      {/* Expanded Raw Line / Details */}
                      {isExpanded && (
                        <div className="mt-2 pl-6 pr-2 pt-1 border-t border-border/20 space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-sans">
                            <span>Raw Log Line</span>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(log.rawLine, log.id);
                              }}
                              className="h-5 px-1 text-[10px] gap-1"
                            >
                              {copiedId === log.id ? (
                                <>
                                  <Check className="size-2.5 text-emerald-500" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-2.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </Button>
                          </div>
                          <pre className="p-2 rounded bg-card border border-border/60 text-[10.5px] text-muted-foreground break-all whitespace-pre-wrap">
                            <HighlightedText text={log.rawLine} query={query} />
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Load More Logs */}
                {diagnosticsHasMore && (
                  <div className="p-3 text-center">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => loadDiagnostics(diagnosticsOffset + 100, true)}
                      disabled={isLoadingDiagnostics}
                      className="font-mono text-xs"
                    >
                      {isLoadingDiagnostics ? "Loading..." : "Load More Logs"}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-2.5 border-t border-border/70 bg-card flex items-center justify-between text-xs text-muted-foreground shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>
              Session:{" "}
              <strong className="text-foreground">
                {selectedSessionId === "current"
                  ? "Current"
                  : selectedSessionId === "all"
                  ? "All"
                  : selectedSessionId.slice(0, 12) + "..."}
              </strong>
            </span>
            <span>·</span>
            <span>
              {activeTab === "activity"
                ? `Showing ${activityEvents.length} of ${activityTotalCount} events`
                : `Showing ${diagnosticLogs.length} of ${diagnosticsTotalCount} lines`}
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground/60">
            Privacy: API keys and source texts are never logged
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
