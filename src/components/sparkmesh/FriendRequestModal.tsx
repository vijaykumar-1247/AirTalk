import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FriendRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderName: string;
  senderAvatarUrl?: string;
  requestMessage?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function FriendRequestModal({
  open,
  onOpenChange,
  senderName,
  senderAvatarUrl,
  requestMessage,
  onAccept,
  onDecline,
}: FriendRequestModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Friend Request</DialogTitle>
          <DialogDescription>
            {senderName} wants to connect with you
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-4 py-4">
          <div className="flex-shrink-0">
            {senderAvatarUrl ? (
              <img
                src={senderAvatarUrl}
                alt={senderName}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">
                {senderName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium">{senderName}</h3>
            {requestMessage && (
              <p className="text-sm text-muted-foreground mt-1">
                "{requestMessage}"
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              onDecline();
              onOpenChange(false);
            }}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Decline
          </Button>
          <Button
            onClick={() => {
              onAccept();
              onOpenChange(false);
            }}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}