import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { Header } from "./components/Header";
import { StatusBar } from "./components/StatusBar";
import { TextEditor, type EditorSelectionRange } from "./features/editor/TextEditor";
import { GraphViewport } from "./features/analysis/graph/GraphViewport";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";
import { SettingsDialog } from "./features/settings/SettingsDialog";
import { DocumentSwitcher } from "./features/documents/DocumentSwitcher";
import {
  fetchDocumentList,
  fetchDocumentById,
  saveNewDocument,
  updateExistingDocument,
} from "./features/documents/documentService";
import type { Document } from "./features/documents/types";
import { loadAppSettings } from "./features/settings/settingsService";
import type { AppSettings } from "./features/settings/types";
import {
  requestDocumentAnalysis,
  fetchLatestAnalysis,
  saveUserOverrides,
} from "./features/analysis/analysisService";
import type {
  CanonicalAnalysis,
  MovementKind,
  SegmentOverride,
  UserOverrides,
  AnalysisRetryState,
} from "./features/analysis/types";
import type { MetricKind } from "./features/analysis/graph/graphTypes";
import { unitizeText } from "./features/analysis/unitization";
import { parseAppError, type ParsedAppError } from "./lib/errors";
import { getLogger } from "./lib/logging";
import {
  ipcSyncWordWrapMenu,
  type AnalysisRetryPayload,
  type AnalysisAttemptPayload,
} from "./lib/tauri/ipc";

const logger = getLogger(["ui", "app"]);

export default function App() {
  // Application settings state
  const [settings, setSettings] = useState<AppSettings>({
    hasApiKey: false,
    apiKeyStatus: { state: "missing" },
    modelId: "gemini-3.8-flash",
    customInstruction: "",
    theme: "system",
  });

  // Dialogs state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);

  // Document state
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editor pane collapse state & panel ref
  const editorPanelRef = usePanelRef();
  const [editorCollapsed, setEditorCollapsed] = useState(false);

  // Word wrap state with local persistence
  const [wordWrap, setWordWrap] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("text-dynamics.editor.word-wrap");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const handleToggleWordWrap = useCallback(() => {
    setWordWrap((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("text-dynamics.editor.word-wrap", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Listen to native Tauri menu "menu:toggle-word-wrap" event
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("menu:toggle-word-wrap", () => {
      handleToggleWordWrap();
    })
      .then((unsub) => {
        unlisten = unsub;
      })
      .catch(() => {});

    return () => {
      unlisten?.();
    };
  }, [handleToggleWordWrap]);

  // Global keyboard shortcut for Word Wrap (Alt+Z / Option+Z)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === "z" || e.key === "Z" || e.code === "KeyZ")) {
        e.preventDefault();
        handleToggleWordWrap();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleWordWrap]);

  // Synchronize native macOS menu checkmark
  useEffect(() => {
    void ipcSyncWordWrapMenu(wordWrap).catch(() => {});
  }, [wordWrap]);

  // Layout persistence with official useDefaultLayout hook
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "text-dynamics.workspace-layout.v1",
    storage: localStorage,
  });

  const handleToggleEditor = useCallback(() => {
    const panel = editorPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [editorPanelRef]);

  // Analysis state
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<CanonicalAnalysis | null>(null);
  const [currentOverrides, setCurrentOverrides] = useState<UserOverrides>({
    segmentOverrides: {},
    movementOverrides: {},
    groups: [],
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [retryState, setRetryState] = useState<AnalysisRetryState | null>(null);
  const [activeError, setActiveError] = useState<ParsedAppError | null>(null);

  // Listen for backend analysis retry & attempt events
  useEffect(() => {
    let unlistenRetry: (() => void) | undefined;
    let unlistenAttempt: (() => void) | undefined;

    listen<AnalysisRetryPayload>("analysis:retry", (event) => {
      logger.warn("Analysis retry event: attempt={attempt}/{maxRetries} delay={delayMs}ms", {
        attempt: event.payload.attempt,
        maxRetries: event.payload.maxRetries,
        delayMs: event.payload.delayMs,
      });
      setRetryState({
        attempt: event.payload.attempt,
        maxRetries: event.payload.maxRetries,
        delayMs: event.payload.delayMs,
        remainingMs: event.payload.delayMs,
        statusCode: event.payload.statusCode,
        message: event.payload.message,
        isWaiting: true,
      });
    })
      .then((unsub) => {
        unlistenRetry = unsub;
      })
      .catch((err) => {
        logger.error("Failed to register analysis:retry listener: {err}", { err: String(err) });
      });

    listen<AnalysisAttemptPayload>("analysis:attempt", (event) => {
      logger.info("Analysis attempt event: attempt={attempt}/{maxAttempts}", {
        attempt: event.payload.attempt,
        maxAttempts: event.payload.maxAttempts,
      });
      if (event.payload.attempt > 1) {
        setRetryState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            remainingMs: 0,
            isWaiting: false,
          };
        });
      }
    })
      .then((unsub) => {
        unlistenAttempt = unsub;
      })
      .catch((err) => {
        logger.error("Failed to register analysis:attempt listener: {err}", { err: String(err) });
      });

    return () => {
      unlistenRetry?.();
      unlistenAttempt?.();
    };
  }, []);

  // Live countdown tick for retry remaining time
  useEffect(() => {
    if (!retryState || !retryState.isWaiting || retryState.remainingMs <= 0) return;

    const timer = window.setInterval(() => {
      setRetryState((prev) => {
        if (!prev || !prev.isWaiting) return prev;
        const nextRemaining = Math.max(0, prev.remainingMs - 100);
        return {
          ...prev,
          remainingMs: nextRemaining,
        };
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [retryState?.isWaiting, retryState?.remainingMs]);

  // Segment selection state (supports multi-selection)
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [selectedLineRange, setSelectedLineRange] = useState<EditorSelectionRange | null>(null);

  // Debounced auto-save timer ref
  const saveTimeoutRef = useRef<number | null>(null);
  const latestContentRef = useRef(editorContent);
  latestContentRef.current = editorContent;
  const currentDocRef = useRef(currentDoc);
  currentDocRef.current = currentDoc;

  // Overrides persistence ref & function
  const currentOverridesRef = useRef(currentOverrides);
  currentOverridesRef.current = currentOverrides;

  const persistOverrides = useCallback(async (overridesToPersist: UserOverrides) => {
    if (!currentAnalysisId) return;
    try {
      await saveUserOverrides(currentAnalysisId, overridesToPersist);
      logger.debug("Persisted user overrides for analysis id={id}", { id: currentAnalysisId });
    } catch (err) {
      logger.error("Failed to save user overrides: {err}", { err: String(err) });
    }
  }, [currentAnalysisId]);

  // Initial load
  useEffect(() => {
    void initializeApp();
  }, []);

  async function initializeApp() {
    try {
      const loadedSettings = await loadAppSettings();
      setSettings(loadedSettings);

      const docs = await fetchDocumentList();
      if (docs.length > 0) {
        await switchDocument(docs[0].id);
      } else {
        // Create initial untitled document if none exist
        const initialDoc = await saveNewDocument({
          title: "Untitled Poem",
          content: "",
        });
        setCurrentDoc(initialDoc);
        setEditorContent(initialDoc.content);
      }
    } catch (err) {
      logger.error("Error during app initialization: {error}", { error: String(err) });
    }
  }

  // Load a document and its latest analysis
  async function switchDocument(docId: string) {
    // Flush pending changes of previous document if any
    await flushPendingSave();

    try {
      const doc = await fetchDocumentById(docId);
      setCurrentDoc(doc);
      setEditorContent(doc.content);
      setIsDirty(false);
      setSelectedSegmentIds([]);
      setSelectedLineRange(null);
      setActiveError(null);

      // Load latest persisted analysis for this document
      const analysisResult = await fetchLatestAnalysis(docId);
      if (analysisResult) {
        setCurrentAnalysisId(analysisResult.record.id);
        setCurrentAnalysis(analysisResult.analysis);
        setCurrentOverrides(
          analysisResult.overrides ?? {
            segmentOverrides: {},
            movementOverrides: {},
            groups: [],
          }
        );
      } else {
        setCurrentAnalysisId(null);
        setCurrentAnalysis(null);
        setCurrentOverrides({
          segmentOverrides: {},
          movementOverrides: {},
          groups: [],
        });
      }
    } catch (err) {
      const parsed = parseAppError(err);
      setActiveError(parsed);
    }
  }

  // Auto-save logic
  const performSave = useCallback(async (contentToSave: string, title?: string) => {
    const doc = currentDocRef.current;
    if (!doc) return;

    setIsSaving(true);
    try {
      const updated = await updateExistingDocument({
        id: doc.id,
        title: title ?? doc.title,
        content: contentToSave,
      });
      setCurrentDoc(updated);
      setIsDirty(false);
    } catch (err) {
      logger.error("Failed to auto-save document: {error}", { error: String(err) });
    } finally {
      setIsSaving(false);
    }
  }, []);

  async function flushPendingSave() {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (isDirty && currentDocRef.current) {
      await performSave(latestContentRef.current);
    }
  }

  function handleEditorChange(newContent: string) {
    setEditorContent(newContent);
    setIsDirty(true);

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void performSave(newContent);
    }, 600);
  }

  async function handleTitleChange(newTitle: string) {
    if (!currentDoc) return;
    setCurrentDoc((prev) => (prev ? { ...prev, title: newTitle } : null));
    await performSave(editorContent, newTitle);
  }

  // Reload settings when changed in modal
  async function handleSettingsSaved() {
    const reloaded = await loadAppSettings();
    setSettings(reloaded);
  }

  // Analysis workflow
  async function handleAnalyze() {
    if (!currentDoc || isAnalyzing) return;
    if (!editorContent.trim()) return;

    // Check if API key is present before launching
    if (!settings.hasApiKey) {
      setActiveError({
        category: "missing_api_key",
        title: "API Key Required",
        message: "No Gemini API key found. Please configure your API key in Settings to run analysis.",
        isActionableApiKey: true,
      });
      return;
    }

    // Save current document text first so Rust reads up-to-date content
    await flushPendingSave();

    setIsAnalyzing(true);
    setRetryState(null);
    setActiveError(null);

    try {
      const unitsPayload = unitization.units.map((u) => ({
        id: u.id,
        text: u.text,
      }));

      const result = await requestDocumentAnalysis(
        currentDoc.id,
        settings.customInstruction.trim() || undefined,
        settings.modelId.trim() || undefined,
        unitsPayload
      );

      // Successfully received valid canonical analysis
      // Invariant: New analysis starts with a fresh override layer (new segment IDs)
      setCurrentAnalysisId(result.record.id);
      setCurrentAnalysis(result.analysis);
      setCurrentOverrides({
        segmentOverrides: {},
        movementOverrides: {},
        groups: [],
      });
      setSelectedSegmentIds([]);
      setSelectedLineRange(null);
      logger.info("Analysis completed successfully id={id}", { id: result.record.id });
    } catch (err) {
      const parsed = parseAppError(err);
      logger.error("Analysis failed category={cat}: {err}", {
        cat: parsed.category,
        err: parsed.message,
      });
      setActiveError(parsed);
      // Invariant: We intentionally do NOT clear `currentAnalysis` so previous valid analysis is preserved!
    } finally {
      setIsAnalyzing(false);
      setRetryState(null);
    }
  }

  // Compute deterministic unitization from current editor content
  const unitization = useMemo(() => {
    return unitizeText(editorContent);
  }, [editorContent]);

  // Synchronize Graph -> Editor selection
  function handleSelectSegment(segmentId: string, isMulti: boolean) {
    let nextSelected: string[];
    if (isMulti) {
      if (selectedSegmentIds.includes(segmentId)) {
        nextSelected = selectedSegmentIds.filter((id) => id !== segmentId);
      } else {
        nextSelected = [...selectedSegmentIds, segmentId];
      }
    } else {
      nextSelected = [segmentId];
    }
    setSelectedSegmentIds(nextSelected);

    if (!currentAnalysis) return;

    // Focus editor on primary/latest selected segment
    const targetSegment = currentAnalysis.segments.find((s) => s.id === segmentId);
    if (!targetSegment) return;

    const startUnit = unitization.units.find((u) => u.id === targetSegment.startUnitId);
    const endUnit = unitization.units.find((u) => u.id === targetSegment.endUnitId);

    if (startUnit && endUnit) {
      setSelectedLineRange({
        startLine: startUnit.lineIndex + 1,
        endLine: endUnit.lineIndex + 1,
        startOffset: startUnit.startIndex,
        endOffset: endUnit.endIndex,
      });
    } else {
      setSelectedLineRange(null);
    }
  }

  // Synchronize Editor -> Graph selection (caret tracking)
  const cursorDebounceRef = useRef<number | null>(null);
  function handleEditorCursorChange(cursorOffset: number) {
    if (!currentAnalysis || isAnalyzing) return;

    if (cursorDebounceRef.current !== null) {
      window.clearTimeout(cursorDebounceRef.current);
    }

    cursorDebounceRef.current = window.setTimeout(() => {
      // Find unit covering cursorOffset
      const unit = unitization.units.find(
        (u) => cursorOffset >= u.startIndex && cursorOffset <= u.endIndex
      );
      if (!unit) return;

      // Find segment spanning this unit
      const segment = currentAnalysis.segments.find((seg) => {
        const segUnits = unitization.units;
        const sIdx = segUnits.findIndex((u) => u.id === seg.startUnitId);
        const eIdx = segUnits.findIndex((u) => u.id === seg.endUnitId);
        const targetIdx = unit.index;
        return targetIdx >= sIdx && targetIdx <= eIdx;
      });

      if (segment && !selectedSegmentIds.includes(segment.id)) {
        setSelectedSegmentIds([segment.id]);
      }
    }, 120);
  }

  // Override Management Callbacks
  function handleUpdateSegmentOverride(segmentId: string, override: SegmentOverride) {
    setCurrentOverrides((prev) => {
      const next = {
        ...prev,
        segmentOverrides: {
          ...prev.segmentOverrides,
          [segmentId]: override,
        },
      };
      void persistOverrides(next);
      return next;
    });
  }

  function handleResetSegmentOverride(segmentId: string) {
    setCurrentOverrides((prev) => {
      const nextOverrides = { ...prev.segmentOverrides };
      delete nextOverrides[segmentId];
      const next = {
        ...prev,
        segmentOverrides: nextOverrides,
      };
      void persistOverrides(next);
      return next;
    });
  }

  function handleUpdateMovementOverride(movementId: string, newKind: MovementKind) {
    setCurrentOverrides((prev) => {
      const next = {
        ...prev,
        movementOverrides: {
          ...prev.movementOverrides,
          [movementId]: { kind: newKind },
        },
      };
      void persistOverrides(next);
      return next;
    });
  }

  function handleResetMovementOverride(movementId: string) {
    setCurrentOverrides((prev) => {
      const nextOverrides = { ...prev.movementOverrides };
      delete nextOverrides[movementId];
      const next = {
        ...prev,
        movementOverrides: nextOverrides,
      };
      void persistOverrides(next);
      return next;
    });
  }

  function handleAddGroup(label: string, segmentIds: string[]) {
    setCurrentOverrides((prev) => {
      const newGroup = {
        id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        segmentIds,
      };
      const next = {
        ...prev,
        groups: [...prev.groups, newGroup],
      };
      void persistOverrides(next);
      return next;
    });
  }

  function handleRemoveGroup(groupId: string) {
    setCurrentOverrides((prev) => {
      const next = {
        ...prev,
        groups: prev.groups.filter((g) => g.id !== groupId),
      };
      void persistOverrides(next);
      return next;
    });
  }

  function handleSelectGroup(segmentIds: string[]) {
    setSelectedSegmentIds(segmentIds);
    if (segmentIds.length > 0) {
      handleSelectSegment(segmentIds[0], false);
    }
  }

  // Real-time drag override for nodes
  function handleDragOverride(
    segmentId: string,
    metric: MetricKind,
    newValue: number
  ) {
    setCurrentOverrides((prev) => {
      const existing = prev.segmentOverrides[segmentId] ?? {};
      return {
        ...prev,
        segmentOverrides: {
          ...prev.segmentOverrides,
          [segmentId]: {
            ...existing,
            [metric]: newValue,
          },
        },
      };
    });
  }

  function handleDragEnd() {
    void persistOverrides(currentOverridesRef.current);
  }

  const lines = editorContent.split("\n");
  const lineCount = editorContent.length > 0 ? lines.length : 0;
  const charCount = editorContent.length;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      {/* Top Header */}
      <Header
        documentTitle={currentDoc?.title || "Untitled Document"}
        onTitleChange={handleTitleChange}
        onOpenDocuments={() => setIsDocumentsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        canAnalyze={editorContent.trim().length > 0}
        retryState={retryState}
        onToggleEditor={handleToggleEditor}
        isEditorCollapsed={editorCollapsed}
      />

      {/* Main Workspace (Resizable Split View) */}
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="flex-1 overflow-hidden"
      >
        {/* Left: Collapsible Text Editor */}
        <ResizablePanel
          id="source-editor"
          panelRef={editorPanelRef}
          defaultSize="40%"
          minSize="18%"
          maxSize="65%"
          collapsible={true}
          collapsedSize="0%"
          className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden"
          onResize={(size) => {
            setEditorCollapsed(size.asPercentage === 0);
          }}
        >
          <TextEditor
            content={editorContent}
            onChange={handleEditorChange}
            collapsed={editorCollapsed}
            onToggleCollapse={handleToggleEditor}
            selectedRange={selectedLineRange}
            onCursorChange={handleEditorCursorChange}
            wordWrap={wordWrap}
            onToggleWordWrap={handleToggleWordWrap}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Custom SVG Graph Viewport with Interactions */}
        <ResizablePanel
          id="graph-workspace"
          defaultSize="60%"
          minSize="35%"
          className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden"
        >
          <GraphViewport
            analysis={currentAnalysis}
            overrides={currentOverrides}
            sourceUnits={unitization.units}
            isAnalyzing={isAnalyzing}
            retryState={retryState}
            selectedSegmentIds={selectedSegmentIds}
            onSelectSegment={handleSelectSegment}
            onUpdateSegmentOverride={handleUpdateSegmentOverride}
            onResetSegmentOverride={handleResetSegmentOverride}
            onUpdateMovementOverride={handleUpdateMovementOverride}
            onResetMovementOverride={handleResetMovementOverride}
            onAddGroup={handleAddGroup}
            onRemoveGroup={handleRemoveGroup}
            onSelectGroup={handleSelectGroup}
            onClearSelection={() => setSelectedSegmentIds([])}
            onDragOverride={handleDragOverride}
            onDragEnd={handleDragEnd}
            analysisId={currentAnalysisId}
            modelId={settings.modelId}
            sourceText={editorContent}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Bottom Status Bar with Compact Error Area */}
      <StatusBar
        isSaving={isSaving}
        isDirty={isDirty}
        charCount={charCount}
        lineCount={lineCount}
        modelId={settings.modelId}
        hasApiKey={settings.hasApiKey}
        apiKeyStatus={settings.apiKeyStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeError={activeError}
        onDismissError={() => setActiveError(null)}
      />

      {/* Settings Modal */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        onSettingsSaved={handleSettingsSaved}
      />

      {/* Documents Switcher Modal */}
      <DocumentSwitcher
        open={isDocumentsOpen}
        onOpenChange={setIsDocumentsOpen}
        currentDocumentId={currentDoc?.id || null}
        onSelectDocument={switchDocument}
        onDocumentCreated={switchDocument}
      />
    </div>
  );
}
