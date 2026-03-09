import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAvatarTemplateBySeed } from "@/lib/offline-p2p";
import type { CallSession, SparkMeshUser } from "@/types/sparkmesh";

interface CallModalProps {
  callSession: CallSession;
  targetUser?: SparkMeshUser;
  isMuted: boolean;
  speakerOn: boolean;
  videoEnabled: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleVideo: () => void;
  onAcceptCall: () => void;
  onEndCall: () => void;
}

const formatDuration = (value: number) => {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const secs = (value % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const CallModal = ({
  callSession,
  targetUser,
  isMuted,
  speakerOn,
  videoEnabled,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onAcceptCall,
  onEndCall,
}: CallModalProps) => {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (callSession.status !== "active" || !callSession.open) {
      setDuration(0);
      return;
    }

    const timer = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [callSession.status, callSession.open]);

  const statusLabel = useMemo(() => {
    if (callSession.status === "incoming") return "Incoming call";
    if (callSession.status === "ringing") return "Ringing...";
    return formatDuration(duration);
  }, [callSession.status, duration]);

  if (!callSession.open || !targetUser) return null;

  const callAvatar = targetUser.avatarUrl ?? getAvatarTemplateBySeed(targetUser.uniqueId ?? targetUser.name).dataUrl;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-call-surface px-6 py-14 text-call-foreground">
      <div className="absolute inset-0 bg-gradient-call opacity-90" />
      <div className="absolute inset-0 bg-noise opacity-35" />

      <div className="relative flex w-full flex-col items-center gap-4 pt-4">
        <div className="h-44 w-44 rounded-full border border-border/50 bg-card p-2 shadow-glow">
          <img alt={`${targetUser.name} profile`} className="h-full w-full rounded-full object-cover" src={callAvatar} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{targetUser.name}</h2>
          <p className="text-sm text-call-muted">{statusLabel}</p>
        </div>
      </div>

      <div className="relative w-full max-w-sm space-y-4">
        {callSession.status === "incoming" && (
          <Button className="w-full" onClick={onAcceptCall} variant="secondary">
            Accept Call
          </Button>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Button onClick={onToggleMute} variant="outline">
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button onClick={onToggleSpeaker} variant="outline">
            {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          <Button onClick={onToggleVideo} variant="outline">
            {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        </div>

        <Button className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onEndCall}>
          <PhoneOff className="mr-2 h-4 w-4" />
          End Call
        </Button>
      </div>
    </div>
  );
};

export default CallModal;
