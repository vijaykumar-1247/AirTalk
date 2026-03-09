import { Pin, PinOff, Smile, Star, StarOff, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageHoldActionsProps {
  selectedCount: number;
  canDelete: boolean;
  canReact: boolean;
  showPin: boolean;
  isPinned: boolean;
  isStarred: boolean;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleStar: () => void;
  onReact: (emoji: string) => void;
  onCancel: () => void;
}

const quickEmojis = ["👍", "❤️", "😂", "😮", "🙏"];

const MessageHoldActions = ({
  selectedCount,
  canDelete,
  canReact,
  showPin,
  isPinned,
  isStarred,
  onDelete,
  onTogglePin,
  onToggleStar,
  onReact,
  onCancel,
}: MessageHoldActionsProps) => {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-2 shadow-sm">
      {canReact && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            <Smile className="mr-1 h-3.5 w-3.5" />
            React
          </span>
          {quickEmojis.map((emoji) => (
            <button
              className="rounded-full bg-background px-2.5 py-1 text-base text-foreground transition hover:bg-accent"
              key={emoji}
              onClick={() => onReact(emoji)}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {showPin && (
          <Button className="gap-1 dark:text-foreground dark:ring-1 dark:ring-accent/35" onClick={onTogglePin} size="sm" type="button" variant="secondary">
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {isPinned ? "Unpin" : "Pin"}
          </Button>
        )}

        <Button className="gap-1 dark:text-foreground dark:ring-1 dark:ring-accent/35" onClick={onToggleStar} size="sm" type="button" variant="secondary">
          {isStarred ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
          {isStarred ? "Unstar" : selectedCount > 1 ? "Star all" : "Star"}
        </Button>

        {canDelete ? (
          <Button className="gap-1 dark:text-destructive-foreground dark:ring-1 dark:ring-destructive/55" onClick={onDelete} size="sm" type="button" variant="destructive">
            <Trash2 className="h-3.5 w-3.5" />
            {selectedCount > 1 ? "Delete selected" : "Delete"}
          </Button>
        ) : (
          <div className="hidden sm:block" />
        )}

        <Button className="gap-1 dark:text-foreground" onClick={onCancel} size="sm" type="button" variant="outline">
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default MessageHoldActions;
