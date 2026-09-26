import { useState, useEffect } from "react";
import {
  fetchDocumentList,
  saveNewDocument,
  removeDocument,
} from "./documentService";
import type { DocumentSummary } from "./types";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { FileText, Plus, Trash2, Clock, Check } from "lucide-react";

interface DocumentSwitcherProps {
  currentDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onDocumentCreated: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentSwitcher({
  currentDocumentId,
  onSelectDocument,
  onDocumentCreated,
  open,
  onOpenChange,
}: DocumentSwitcherProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      void refreshList();
    }
  }, [open]);

  async function refreshList() {
    setIsLoading(true);
    try {
      const list = await fetchDocumentList();
      setDocuments(list);
    } catch {
      // Service logs error
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateNew() {
    setIsCreating(true);
    try {
      const newDoc = await saveNewDocument({
        title: "Untitled Document",
        content: "",
      });
      await refreshList();
      onDocumentCreated(newDoc.id);
      onOpenChange(false);
    } catch {
      // Service logs error
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await removeDocument(id);
      const updated = documents.filter((d) => d.id !== id);
      setDocuments(updated);

      if (id === currentDocumentId) {
        if (updated.length > 0) {
          onSelectDocument(updated[0].id);
        } else {
          // If all documents deleted, create a fresh untitled one
          const fresh = await saveNewDocument({
            title: "Untitled Document",
            content: "",
          });
          onDocumentCreated(fresh.id);
        }
      }
    } catch {
      // Handled in service
    }
  }

  function formatTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 sm:max-w-lg">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-3 pr-6">
          <div>
            <DialogTitle className="text-base font-semibold tracking-tight">
              Documents
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Local documents saved in SQLite storage.
            </DialogDescription>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={handleCreateNew}
            disabled={isCreating}
            className="gap-1 font-mono text-xs"
          >
            <Plus className="size-3" />
            New
          </Button>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No documents yet. Click "New" to start writing.
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {documents.map((doc) => {
                const isSelected = doc.id === currentDocumentId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      onSelectDocument(doc.id);
                      onOpenChange(false);
                    }}
                    className={`group flex cursor-pointer items-center justify-between p-2.5 transition-colors hover:bg-muted/50 ${
                      isSelected ? "bg-muted/80 font-medium" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs text-foreground">
                            {doc.title || "Untitled Document"}
                          </span>
                          {isSelected && (
                            <Check className="size-3 shrink-0 text-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {formatTime(doc.updatedAt)}
                          </span>
                          <span>•</span>
                          <span>{doc.lineCount} lines</span>
                          <span>•</span>
                          <span>{doc.charCount} chars</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => void handleDelete(e, doc.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      title="Delete document"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
