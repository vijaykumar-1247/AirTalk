import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { avatarTemplates, getAvatarTemplateByIndex } from "@/lib/offline-p2p";

interface ProfileAvatarBarProps {
  selectedAvatarIndex: number;
  uploadedAvatar: string | null;
  onAvatarSelect: (index: number) => void;
  onAvatarUpload?: (file: File) => void;
  title?: string;
}

const ProfileAvatarBar = ({ selectedAvatarIndex, uploadedAvatar, onAvatarSelect, onAvatarUpload, title = "Profile Setup" }: ProfileAvatarBarProps) => {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const activeIndex = useMemo(() => Math.max(0, Math.min(avatarTemplates.length - 1, selectedAvatarIndex)), [selectedAvatarIndex]);

  const previousIndex = (activeIndex - 1 + avatarTemplates.length) % avatarTemplates.length;
  const nextIndex = (activeIndex + 1) % avatarTemplates.length;

  const activeAvatar = uploadedAvatar ?? getAvatarTemplateByIndex(activeIndex).dataUrl;
  const previousAvatar = getAvatarTemplateByIndex(previousIndex).dataUrl;
  const nextAvatar = getAvatarTemplateByIndex(nextIndex).dataUrl;

  const movePrevious = () => onAvatarSelect(previousIndex);
  const moveNext = () => onAvatarSelect(nextIndex);

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    if (startX == null) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;

    if (delta > 40) movePrevious();
    if (delta < -40) moveNext();

    touchStartXRef.current = null;
  };

  const hasUpload = Boolean(onAvatarUpload);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="rounded-2xl border border-border bg-muted/30 p-3" onTouchEnd={onTouchEnd} onTouchStart={onTouchStart}>
        <div className="flex items-center justify-between gap-2">
          <button className="group" onClick={movePrevious} type="button">
            <img
              alt="Previous avatar"
              className="h-12 w-12 rounded-full border border-border object-cover opacity-80 transition group-hover:opacity-100"
              loading="lazy"
              src={previousAvatar}
            />
          </button>

          <div className="relative">
            <button
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-background"
              onClick={() => {
                if (hasUpload) uploadInputRef.current?.click();
              }}
              type="button"
            >
              <img alt="Selected profile" className="h-full w-full object-cover" src={activeAvatar} />
            </button>
            {hasUpload ? (
              <span className="absolute -bottom-1 -right-1 rounded-full border border-border bg-card p-1 text-muted-foreground">
                <Upload className="h-3.5 w-3.5" />
              </span>
            ) : null}
            {hasUpload ? (
              <input
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onAvatarUpload?.(file);
                  event.target.value = "";
                }}
                ref={uploadInputRef}
                type="file"
              />
            ) : null}
          </div>

          <button className="group" onClick={moveNext} type="button">
            <img
              alt="Next avatar"
              className="h-12 w-12 rounded-full border border-border object-cover opacity-80 transition group-hover:opacity-100"
              loading="lazy"
              src={nextAvatar}
            />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <Button className="h-8 gap-1 px-2" onClick={movePrevious} size="sm" type="button" variant="outline">
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </Button>
          <Button className="h-8 gap-1 px-2" onClick={moveNext} size="sm" type="button" variant="outline">
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileAvatarBar;
