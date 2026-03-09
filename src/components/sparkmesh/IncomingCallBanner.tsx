import { PhoneCall, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAvatarTemplateBySeed } from "@/lib/offline-p2p";
import type { IncomingCallInvite } from "@/types/sparkmesh";

interface IncomingCallBannerProps {
  invite: IncomingCallInvite;
  onAccept: () => void;
  onDecline: () => void;
}

const IncomingCallBanner = ({ invite, onAccept, onDecline }: IncomingCallBannerProps) => {
  const fallbackAvatar = getAvatarTemplateBySeed(invite.senderName).dataUrl;
  const callLabel = invite.callType === "voice" ? "Incoming Audio Call" : "Incoming Video Call";

  return (
    <div className="mx-3 mt-2 rounded-2xl border border-border bg-card p-3 shadow-card">
      <p className="text-xs text-muted-foreground">{callLabel}</p>
      <div className="mt-1 flex items-center gap-2">
        <img alt={`${invite.senderName} profile`} className="h-8 w-8 rounded-full border border-border object-cover" src={invite.senderAvatarUrl ?? fallbackAvatar} />
        <p className="truncate text-sm font-semibold text-card-foreground">{invite.senderName} is calling you</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button className="gap-2" onClick={onAccept} size="sm" type="button">
          <PhoneCall className="h-4 w-4" />
          Accept
        </Button>
        <Button className="gap-2" onClick={onDecline} size="sm" type="button" variant="outline">
          <PhoneOff className="h-4 w-4" />
          Decline
        </Button>
      </div>
    </div>
  );
};

export default IncomingCallBanner;
