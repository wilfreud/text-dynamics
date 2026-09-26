import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Play, Settings, FolderOpen, Loader2 } from "lucide-react";

interface HeaderProps {
  documentTitle: string;
  onTitleChange: (newTitle: string) => void;
  onOpenDocuments: () => void;
  onOpenSettings: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  canAnalyze: boolean;
}

export function Header({
  documentTitle,
  onTitleChange,
  onOpenDocuments,
  onOpenSettings,
  onAnalyze,
  isAnalyzing,
  canAnalyze,
}: HeaderProps) {
  const [title, setTitle] = useState(documentTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    setTitle(documentTitle);
  }, [documentTitle]);

  function handleTitleBlur() {
    setIsEditingTitle(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== documentTitle) {
      onTitleChange(trimmed);
    } else {
      setTitle(documentTitle);
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setTitle(documentTitle);
      setIsEditingTitle(false);
    }
  }

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-border/80 bg-card px-4 select-none">
      {/* Left: Document Selector & Editable Title */}
      <div className="flex items-center gap-3 min-w-0 max-w-[50%]">
        <Button
          variant="outline"
          size="xs"
          onClick={onOpenDocuments}
          className="gap-1.5 font-mono text-xs shrink-0"
          title="Switch or create document"
        >
          <FolderOpen className="size-3.5" />
          <span>Documents</span>
        </Button>

        <div className="h-4 w-px bg-border/80 shrink-0" />

        {isEditingTitle ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            className="h-7 w-64 rounded border border-ring bg-background px-2 font-heading text-sm font-medium text-foreground outline-none"
          />
        ) : (
          <span
            onClick={() => setIsEditingTitle(true)}
            className="cursor-pointer truncate font-heading text-sm font-medium text-foreground hover:underline hover:decoration-muted-foreground/50 underline-offset-4"
            title="Click to rename"
          >
            {title || "Untitled Document"}
          </span>
        )}
      </div>

      {/* Right: Actions (Analyze, Settings) */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={onAnalyze}
          disabled={isAnalyzing || !canAnalyze}
          className="gap-1.5 font-mono text-xs px-3 shadow-none"
          title={!canAnalyze ? "Enter text in the editor to analyze" : "Run text dynamics analysis"}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Play className="size-3.5 fill-current" />
              <span>Analyze</span>
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSettings}
          className="text-muted-foreground hover:text-foreground"
          title="Open Settings"
        >
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
}
