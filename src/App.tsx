import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Header } from "./components/Header";
import { StatusBar } from "./components/StatusBar";
import { TextEditor, type EditorSelectionRange } from "./features/editor/TextEditor";
import { GraphViewport } from "./features/analysis/graph/GraphViewport";
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
} from "./features/analysis/types";
import type { MetricKind } from "./features/analysis/graph/graphTypes";
import { unitizeText } from "./features/analysis/unitization";
import { parseAppError, type ParsedAppError } from "./lib/errors";
import { getLogger } from "./lib/logging";

const logger = getLogger(["ui", "app"]);

export default function App() {
  // Application settings state
  const [settings, setSettings] = useState<AppSettings>({
    hasApiKey: false,
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

  // Editor pane collapse state
  const [editorCollapsed, setEditorCollapsed] = useState(false);

  // Analysis state
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<CanonicalAnalysis | null>(null);
  const [currentOverrides, setCurrentOverrides] = useState<UserOverrides>({
    segmentOverrides: {},
    movementOverrides: {},
    groups: [],
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeError, setActiveError] = useState<ParsedAppError | null>(null);

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
    setActiveError(null);

    try {
      const result = await requestDocumentAnalysis(
        currentDoc.id,
        settings.customInstruction.trim() || undefined,
        settings.modelId.trim() || undefined
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
      />

      {/* Main Workspace (Split View) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Collapsible Text Editor */}
        <TextEditor
          content={editorContent}
          onChange={handleEditorChange}
          collapsed={editorCollapsed}
          onToggleCollapse={() => setEditorCollapsed((prev) => !prev)}
          selectedRange={selectedLineRange}
          onCursorChange={handleEditorCursorChange}
        />

        {/* Right: Custom SVG Graph Viewport with Interactions */}
        <GraphViewport
          analysis={currentAnalysis}
          overrides={currentOverrides}
          sourceUnits={unitization.units}
          isAnalyzing={isAnalyzing}
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
        />
      </div>

      {/* Bottom Status Bar with Compact Error Area */}
      <StatusBar
        isSaving={isSaving}
        isDirty={isDirty}
        charCount={charCount}
        lineCount={lineCount}
        modelId={settings.modelId}
        hasApiKey={settings.hasApiKey}
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
