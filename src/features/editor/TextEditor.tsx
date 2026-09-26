import { useRef, useEffect } from "react";
import { PanelLeftClose } from "lucide-react";
import { Button } from "../../components/ui/button";

export interface EditorSelectionRange {
  startLine: number;
  endLine: number;
  startOffset?: number;
  endOffset?: number;
}

interface TextEditorProps {
  content: string;
  onChange: (value: string) => void;
  collapsed?: boolean;
  onToggleCollapse: () => void;
  selectedRange?: EditorSelectionRange | null;
  onCursorChange?: (cursorOffset: number) => void;
}

export function TextEditor({
  content,
  onChange,
  onToggleCollapse,
  selectedRange,
  onCursorChange,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lines = content.split("\n");
  const lineCount = Math.max(lines.length, 1);

  // Sync scrolling between textarea and line gutter
  function handleScroll() {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }

  // Handle selectedRange synchronization (Graph -> Editor)
  useEffect(() => {
    if (!selectedRange || !textareaRef.current) return;
    const { startLine, startOffset, endOffset } = selectedRange;

    try {
      textareaRef.current.focus();

      if (startOffset !== undefined && endOffset !== undefined) {
        // Exact UTF-16 code unit range from local deterministic unitization
        textareaRef.current.setSelectionRange(startOffset, endOffset);
      } else {
        // Fallback line offset calculation
        let charStart = 0;
        let charEnd = 0;
        let currentLine = 1;

        for (let i = 0; i < lines.length; i++) {
          const lineLen = lines[i].length + 1;
          if (currentLine < startLine) {
            charStart += lineLen;
          }
          if (currentLine <= selectedRange.endLine) {
            charEnd += lineLen;
          }
          currentLine++;
        }
        textareaRef.current.setSelectionRange(charStart, Math.max(charStart, charEnd - 1));
      }

      // Scroll target line into view smoothly
      const lineHeightPx = 20;
      const targetScrollTop = (startLine - 2) * lineHeightPx;
      textareaRef.current.scrollTop = Math.max(0, targetScrollTop);
    } catch {
      // Ignore selection errors on unmounted/hidden elements
    }
  }, [selectedRange, content]);

  // Track cursor position (Editor -> Graph)
  function handleCursorEvent() {
    if (!textareaRef.current || !onCursorChange) return;
    const offset = textareaRef.current.selectionStart;
    onCursorChange(offset);
  }

  return (
    <aside className="relative flex h-full w-full min-w-0 flex-col bg-card select-none">
      {/* Editor Header */}
      <div className="flex h-9 items-center justify-between border-b border-border/70 px-3 py-1 bg-muted/20 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
            Source Text
          </span>
          <span className="text-[11px] font-mono text-muted-foreground/80 shrink-0">
            ({lineCount} {lineCount === 1 ? "line" : "lines"})
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Collapse Text Editor"
        >
          <PanelLeftClose className="size-3.5" />
        </Button>
      </div>

      {/* Editor Workspace: Gutter + Textarea */}
      <div className="relative flex flex-1 overflow-hidden font-mono text-xs leading-5">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="w-10 select-none overflow-hidden border-r border-border/40 bg-muted/30 py-3 text-right font-mono text-[11px] text-muted-foreground/60 pr-2.5"
        >
          {Array.from({ length: lineCount }).map((_, i) => {
            const lineNum = i + 1;
            const isHighlighted =
              selectedRange &&
              lineNum >= selectedRange.startLine &&
              lineNum <= selectedRange.endLine;
            return (
              <div
                key={lineNum}
                className={isHighlighted ? "text-foreground font-semibold bg-muted/60" : ""}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onClick={handleCursorEvent}
          onKeyUp={handleCursorEvent}
          onSelect={handleCursorEvent}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Paste or write poem here..."
          className="flex-1 resize-none bg-transparent py-3 px-3 font-mono text-xs leading-5 text-foreground placeholder:text-muted-foreground/50 outline-none overflow-y-auto whitespace-pre tab-[2]"
        />
      </div>
    </aside>
  );
}
