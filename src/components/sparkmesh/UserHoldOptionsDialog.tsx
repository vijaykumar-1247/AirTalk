import { Archive, ArchiveRestore, Ban, Pin, PinOff, Trash2, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UserHoldOptionsDialogProps {
  open: boolean;
  userName: string;
  isArchived: boolean;
  isBlocked: boolean;
  isPinned: boolean;
  onClose: () => void;
  onToggleArchive: () => void;
  onToggleBlock: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

const UserHoldOptionsDialog = ({
  open,
  userName,
  isArchived,
  isBlocked,
  isPinned,
  onClose,
  onToggleArchive,
  onToggleBlock,
  onTogglePin,
  onDelete,
}: UserHoldOptionsDialogProps) => {
  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{userName}</DialogTitle>
          <DialogDescription>Manage this chat from your Home list.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Button className="justify-start gap-2 dark:text-foreground dark:ring-1 dark:ring-accent/35" onClick={onTogglePin} type="button" variant="secondary">
            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            {isPinned ? "Unpin user" : "Pin user"}
          </Button>

          <Button className="justify-start gap-2 dark:text-foreground dark:ring-1 dark:ring-accent/35" onClick={onToggleArchive} type="button" variant="secondary">
            {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {isArchived ? "Unarchive chat" : "Archive chat"}
          </Button>

          <Button className="justify-start gap-2 dark:text-foreground dark:ring-1 dark:ring-accent/35" onClick={onToggleBlock} type="button" variant={isBlocked ? "outline" : "secondary"}>
            {isBlocked ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            {isBlocked ? "Unblock user" : "Block user"}
          </Button>

          <Button className="justify-start gap-2 dark:text-destructive-foreground dark:ring-1 dark:ring-destructive/55" onClick={onDelete} type="button" variant="destructive">
            <Trash2 className="h-4 w-4" />
            Delete from my list
          </Button>
        </div>

        <DialogFooter>
          <Button className="dark:text-foreground" onClick={onClose} type="button" variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserHoldOptionsDialog;
