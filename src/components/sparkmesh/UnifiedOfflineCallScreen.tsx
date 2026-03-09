import { ArrowLeft, Lock, MessageSquare, Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOfflineWebRTC } from "@/hooks/useOfflineWebRTC";

type UnifiedOfflineCallScreenProps = {
  peerId: string;
  isCaller: boolean;
  userName?: string;
  avatarUrl?: string;
  onBack?: () => void;
  onEndCall?: () => void;
  onOpenChat?: () => void;
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const UnifiedOfflineCallScreen = ({
  peerId,
  isCaller,
  userName = "Vijay",
  avatarUrl,
  onBack,
  onEndCall,
  onOpenChat,
}: UnifiedOfflineCallScreenProps) => {
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(15);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const { localStream, remoteStream, isMuted, toggleMute, endCall, error } = useOfflineWebRTC({
    peerId,
    isCaller,
    isVideoOn,
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const callTime = useMemo(() => formatDuration(elapsedSeconds), [elapsedSeconds]);

  const controlBase =
    "inline-flex h-14 w-14 items-center justify-center rounded-full border border-border transition-all duration-200 active:scale-95";

  const inactiveControl = `${controlBase} bg-call-foreground/20 text-call-foreground hover:bg-call-foreground/30`;
  const activeControl = `${controlBase} bg-call-foreground text-call-surface shadow-glow`;

  const stopCall = () => {
    endCall();
    onEndCall?.();
  };

  return (
    <main
      className={`fixed inset-0 z-[95] h-screen w-screen overflow-hidden text-call-foreground transition-all duration-300 ${
        isVideoOn
          ? "bg-call-surface"
          : "bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.42),_hsl(var(--call-surface))_52%,_hsl(var(--overlay)))]"
      }`}
    >
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-4">
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-call-foreground/15 text-call-foreground" onClick={onBack} type="button">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="inline-flex items-center gap-2 rounded-full bg-call-foreground/10 px-3 py-1 text-xs text-call-foreground/90">
          <Lock className="h-3.5 w-3.5" />
          End-to-End Encrypted (Offline)
        </p>
      </header>

      {error && (
        <div className="absolute left-4 right-4 top-16 z-30 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      )}

      {!isVideoOn ? (
        <section className="flex h-full flex-col items-center justify-center px-6 pb-32 pt-20 text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-accent/25 blur-xl animate-pulse" />
            <div className="relative h-36 w-36 overflow-hidden rounded-full border border-call-foreground/25 bg-avatar-ring shadow-glow">
              {avatarUrl ? (
                <img alt={`${userName} profile`} className="h-full w-full object-cover" loading="lazy" src={avatarUrl} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-foreground">{userName.charAt(0)}</div>
              )}
            </div>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-call-foreground">{userName}</h1>
          <p className="mt-2 text-base font-medium text-call-muted">{callTime}</p>
        </section>
      ) : (
        <section className="relative h-full w-full">
          <div className="absolute inset-0 overflow-hidden bg-overlay">
            {remoteStream ? (
              <video autoPlay className="h-full w-full object-cover" playsInline ref={remoteVideoRef} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-medium text-call-muted">Remote Video</div>
            )}
          </div>

          <div className="absolute bottom-28 right-4 z-10 h-48 w-32 overflow-hidden rounded-xl border border-call-foreground/35 bg-muted shadow-card">
            {localStream ? (
              <video autoPlay className="h-full w-full object-cover" muted playsInline ref={localVideoRef} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">Local Video</div>
            )}
          </div>
        </section>
      )}

      <footer className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6">
        {!isVideoOn ? (
          <div className="mx-auto grid max-w-sm grid-cols-4 gap-3 rounded-2xl border border-call-foreground/15 bg-call-foreground/10 p-3 backdrop-blur">
            <button className={isSpeakerOn ? activeControl : inactiveControl} onClick={() => setIsSpeakerOn((prev) => !prev)} type="button">
              {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button className={isMuted ? activeControl : inactiveControl} onClick={toggleMute} type="button">
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button className={inactiveControl} onClick={() => setIsVideoOn(true)} type="button">
              <Video className="h-5 w-5" />
            </button>
            <button className={`${controlBase} bg-destructive text-destructive-foreground shadow-glow`} onClick={stopCall} type="button">
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-call-foreground/20 bg-call-surface/70 p-3 backdrop-blur">
            <button className={isVideoOn ? activeControl : inactiveControl} onClick={() => setIsVideoOn((prev) => !prev)} type="button">
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
            <button className={isMuted ? inactiveControl : activeControl} onClick={toggleMute} type="button">
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button className={inactiveControl} onClick={onOpenChat} type="button">
              <MessageSquare className="h-5 w-5" />
            </button>
            <button className={`${controlBase} bg-destructive text-destructive-foreground shadow-glow`} onClick={stopCall} type="button">
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        )}
      </footer>
    </main>
  );
};

export default UnifiedOfflineCallScreen;
