import { Save } from "lucide-react";
import ProfileAvatarBar from "@/components/sparkmesh/ProfileAvatarBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface DefaultSenderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  uniqueId: string;
  deviceId: string;
  selectedAvatarIndex: number;
  onAvatarSelect: (avatarIndex: number) => void;
  onSave: () => void;
}

const DefaultSenderModal = ({
  open,
  onOpenChange,
  name,
  uniqueId,
  deviceId,
  selectedAvatarIndex,
  onAvatarSelect,
  onSave,
}: DefaultSenderModalProps) => {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-4">
        <DialogHeader>
          <DialogTitle>Default Sender</DialogTitle>
          <DialogDescription>Swipe to select sender avatar and save your broadcast profile for offline radar.</DialogDescription>
        </DialogHeader>

        <ProfileAvatarBar onAvatarSelect={onAvatarSelect} selectedAvatarIndex={selectedAvatarIndex} title="Sender Avatar" uploadedAvatar={null} />

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input readOnly value={name || "Not available"} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Unique ID</label>
            <Input readOnly value={uniqueId || "Not set"} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Device ID</label>
            <Input readOnly value={deviceId || "Not available"} />
          </div>
        </div>

        <Button className="w-full gap-2" onClick={onSave}>
          <Save className="h-4 w-4" />
          Save Default Sender
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DefaultSenderModal;
