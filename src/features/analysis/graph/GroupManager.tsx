import { useState } from "react";
import type { SegmentGroup } from "../types";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Users, Plus, X, Trash2 } from "lucide-react";

interface GroupManagerProps {
  selectedSegmentIds: string[];
  groups: SegmentGroup[];
  onCreateGroup: (label: string, segmentIds: string[]) => void;
  onDeleteGroup: (groupId: string) => void;
  onSelectGroup: (segmentIds: string[]) => void;
  onClearSelection: () => void;
}

export function GroupManager({
  selectedSegmentIds,
  groups,
  onCreateGroup,
  onDeleteGroup,
  onSelectGroup,
  onClearSelection,
}: GroupManagerProps) {
  const [groupLabel, setGroupLabel] = useState("");

  const isMultiSelect = selectedSegmentIds.length > 1;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = groupLabel.trim();
    if (!trimmed || selectedSegmentIds.length === 0) return;
    onCreateGroup(trimmed, selectedSegmentIds);
    setGroupLabel("");
  }

  if (!isMultiSelect && groups.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col gap-2 rounded-lg border border-border/80 bg-popover/95 p-2 px-3 font-sans text-xs text-popover-foreground shadow-lg backdrop-blur-sm select-none animate-in fade-in slide-in-from-bottom-2 duration-150 max-w-lg">
      {/* Multi-Selection Action Strip */}
      {isMultiSelect && (
        <form
          onSubmit={handleCreate}
          className="flex items-center gap-2 font-mono text-[11px]"
        >
          <span className="font-semibold text-foreground shrink-0">
            {selectedSegmentIds.length} segments:
          </span>
          <Input
            type="text"
            placeholder="Family / Group name..."
            value={groupLabel}
            onChange={(e) => setGroupLabel(e.target.value)}
            className="h-6 w-36 text-xs font-mono"
            autoFocus
          />
          <Button
            type="submit"
            size="xs"
            disabled={!groupLabel.trim()}
            className="h-6 gap-1 px-2 text-[10px]"
          >
            <Plus className="size-2.5" />
            Group
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClearSelection}
            className="text-muted-foreground hover:text-foreground"
            title="Deselect"
          >
            <X className="size-3" />
          </Button>
        </form>
      )}

      {/* Existing Groups Badges */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40 font-mono text-[10px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="size-3" />
            Groups:
          </span>
          {groups.map((group) => (
            <div
              key={group.id}
              className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 text-foreground hover:bg-muted transition-colors cursor-pointer"
              onClick={() => onSelectGroup(group.segmentIds)}
              title={`Click to select all ${group.segmentIds.length} segments in this group`}
            >
              <span>{group.label}</span>
              <span className="text-[9px] text-muted-foreground">
                ({group.segmentIds.length})
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGroup(group.id);
                }}
                className="text-muted-foreground hover:text-destructive ml-0.5"
                title="Delete group"
              >
                <Trash2 className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
