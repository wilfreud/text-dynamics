import { useRef, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "../../components/ui/button";

interface TextEditorProps {
  content: string;
  onChange: (value: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedRange?: { startLine: number; endLine: number } | null;
}

export function TextEditor({
  content,
  onChange,
  collapsed,
  onToggleCollapse,
  selectedRange,
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

  // Handle selectedRange synchronization (e.g., when a segment is selected)
  useEffect(() => {
    if (!selectedRange || !textareaRef.current) return;
    const { startLine, endLine } = selectedRange;

    // Calculate character offsets for startLine and endLine (1-indexed)
    let charStart = 0;
    let charEnd = 0;
    let currentLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length + 1; // +1 for \n
      if (currentLine < startLine) {
        charStart += lineLen;
      }
      if (currentLine <= endLine) {
        charEnd += lineLen;
      }
      currentLine++;
    }

    try {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charStart, Math.max(charStart, charEnd - 1));
      
      // Scroll line into view
      const lineHeightPx = 20; // approximate line height
      const targetScrollTop = (startLine - 2) * lineHeightPx;
      if (textareaRef.current) {
        textareaRef.current.scrollTop = Math.max(0, targetScrollTop);
      }
    } catch {
      // Ignore selection errors
    }
  }, [selectedRange, content]);

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center border-r border-border/70 bg-card py-3 px-1 transition-all select-none">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:text-foreground"
          title="Expand Text Editor"
        >
          <PanelLeftOpen className="size-4" />
        </Button>
        <span
          className="mt-6 font-mono text-[10px] tracking-wider uppercase text-muted-foreground rotate-90 whitespace-nowrap cursor-pointer hover:text-foreground"
          onClick={onToggleCollapse}
        >
          Text Editor
        </span>
      </aside>
    );
  }

  return (
    <aside className="relative flex h-full flex-col border-r border-border/70 bg-card transition-all w-80 sm:w-96 md:w-[420px] shrink-0">
      {/* Editor Header */}
      <div className="flex h-9 items-center justify-between border-b border-border/70 px-3 py-1 bg-muted/20 select-none">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Source Text
          </span>
          <span className="text-[11px] font-mono text-muted-foreground/80">
            ({lineCount} {lineCount === 1 ? "line" : "lines"})
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:text-foreground"
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
                className={isHighlighted ? "text-foreground font-semibold" : ""}
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
