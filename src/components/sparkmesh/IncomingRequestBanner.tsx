import { Check, X } from "lucide-react";
import { useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { getAvatarTemplateBySeed } from "@/lib/offline-p2p";
import type { IncomingAirTalkRequest } from "@/types/sparkmesh";

interface IncomingRequestBannerProps {
  request: IncomingAirTalkRequest;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

const SWIPE_DISMISS_DISTANCE = 88;

const IncomingRequestBanner = ({ request, onAccept, onDecline, onDismiss }: IncomingRequestBannerProps) => {
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const fallbackAvatar = getAvatarTemplateBySeed(request.senderName).dataUrl;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setStartX(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (startX === null) return;
    const offset = event.clientX - startX;
    setDragX(offset);
  };

  const releaseDrag = () => {
    if (Math.abs(dragX) >= SWIPE_DISMISS_DISTANCE) {
      onDismiss();
    }
    setDragX(0);
    setStartX(null);
  };

  return (
    <div
      className="mx-3 mt-2 rounded-2xl border border-border bg-card p-3 shadow-card"
      onPointerCancel={releaseDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releaseDrag}
      style={{
        transform: `translateX(${dragX}px)`,
        transition: startX === null ? "transform 180ms ease" : "none",
        touchAction: "pan-y",
      }}
    >
      <p className="text-xs text-muted-foreground">Incoming Air Talk Request</p>
      <div className="mt-1 flex items-center gap-2">
        <img alt={`${request.senderName} profile`} className="h-8 w-8 rounded-full border border-border object-cover" src={request.senderAvatarUrl ?? fallbackAvatar} />
        <p className="truncate text-sm font-semibold text-card-foreground">{request.senderName}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button className="gap-2" onClick={onAccept} size="sm">
          <Check className="h-4 w-4" />
          Accept
        </Button>
        <Button className="gap-2" onClick={onDecline} size="sm" variant="outline">
          <X className="h-4 w-4" />
          Decline
        </Button>
      </div>
      {request.requestMessage && <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">“{request.requestMessage}”</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">Swipe left or right to dismiss</p>
    </div>
  );
};

export default IncomingRequestBanner;
