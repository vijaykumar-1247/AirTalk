import { Camera, PencilLine } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getAvatarTemplateBySeed } from "@/lib/offline-p2p";

type ProfileSectionProps = {
  avatarPreview: string | null;
  deviceId: string;
  editedName: string;
  editedUniqueId: string;
  isSaving: boolean;
  needsUniqueIdPassword: boolean;
  onAvatarPick: (event: ChangeEvent<HTMLInputElement>) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onConnectOnline?: () => void;
  onConnectOnlineLabel?: string;
  onUniqueIdChange: (value: string) => void;
  onUniqueIdPasswordChange: (value: string) => void;
  uniqueIdPassword: string;
};

const ProfileSection = ({
  avatarPreview,
  deviceId,
  editedName,
  editedUniqueId,
  isSaving,
  needsUniqueIdPassword,
  onAvatarPick,
  onNameChange,
  onSave,
  onConnectOnline,
  onConnectOnlineLabel,
  onUniqueIdChange,
  onUniqueIdPasswordChange,
  uniqueIdPassword,
}: ProfileSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackAvatar = getAvatarTemplateBySeed(editedUniqueId || editedName || deviceId).dataUrl;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-accent">Profile</CardTitle>
        <CardDescription>Photo, display name, unique ID</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <img alt={`${editedName || "User"} profile`} className="h-12 w-12 rounded-full border border-border object-cover" src={avatarPreview ?? fallbackAvatar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{editedName || "No name set"}</p>
            <p className="truncate text-xs text-muted-foreground">@{editedUniqueId || "no-unique-id"}</p>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full justify-between" type="button" variant="outline">
              <span className="flex items-center gap-2">
                <PencilLine className="h-4 w-4" />
                Click to edit user profile
              </span>
              <span className="text-xs text-muted-foreground">Open</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update profile photo, name and unique ID.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <button
                  className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-avatar-ring transition-transform active:scale-95"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <img alt={`${editedName || "User"} profile`} className="h-full w-full object-cover" src={avatarPreview ?? fallbackAvatar} />
                  <span className="absolute bottom-0 right-0 rounded-full bg-background p-1 shadow-card">
                    <Camera className="h-3 w-3 text-foreground" />
                  </span>
                </button>
                <div>
                  <p className="text-muted-foreground">Profile photo</p>
                  <p className="font-medium text-foreground">Tap image to edit</p>
                </div>
                <input accept="image/*" className="hidden" onChange={onAvatarPick} ref={fileInputRef} type="file" />
              </div>

              <Separator />

              <div className="space-y-1">
                <Label htmlFor="profile-name">Name</Label>
                <Input id="profile-name" onChange={(event) => onNameChange(event.target.value)} placeholder="Your display name" value={editedName} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="profile-unique-id">Unique ID</Label>
                <Input
                  id="profile-unique-id"
                  onChange={(event) => onUniqueIdChange(event.target.value)}
                  placeholder="your-unique-id"
                  value={editedUniqueId}
                />
              </div>

              {needsUniqueIdPassword ? (
                <div className="space-y-1">
                  <Label htmlFor="profile-unique-id-password">Current password (required for unique ID change)</Label>
                  <Input
                    id="profile-unique-id-password"
                    onChange={(event) => onUniqueIdPasswordChange(event.target.value)}
                    placeholder="Enter current password"
                    type="password"
                    value={uniqueIdPassword}
                  />
                </div>
              ) : null}

              <div>
                <p className="text-xs text-muted-foreground">Device ID</p>
                <p className="font-mono text-sm font-semibold tracking-wide text-foreground">{deviceId}</p>
              </div>

              <Button
                className="w-full"
                disabled={!editedName.trim() || !editedUniqueId.trim() || isSaving || (needsUniqueIdPassword && !uniqueIdPassword.trim())}
                onClick={onSave}
                type="button"
              >
                Save profile changes
              </Button>

              {onConnectOnline ? (
                <Button className="w-full" onClick={onConnectOnline} type="button" variant="secondary">
                  {onConnectOnlineLabel ?? "Upgrade to Online Air Talk"}
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ProfileSection;
