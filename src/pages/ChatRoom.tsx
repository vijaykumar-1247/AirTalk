import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  EllipsisVertical,
  Mic,
  Paperclip,
  Pause,
  Phone,
  Pin,
  Play,
  Search,
  SendHorizontal,
  Square,
  Star,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import MessageBubble from "@/components/sparkmesh/MessageBubble";
import MessageHoldActions from "@/components/sparkmesh/MessageHoldActions";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSparkMesh } from "@/context/SparkMeshContext";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getAvatarTemplateBySeed } from "@/lib/offline-p2p";
import type { AttachmentPayload, SparkMeshMessage } from "@/types/sparkmesh";

const formatTimer = (value: number) => {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const secs = (value % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const getSignalQuality = (ping: number) => {
  if (ping <= 90) return "excellent";
  if (ping <= 190) return "stable";
  return "weak";
};

const getLastSeenLabel = (lastSeen?: string | null) => {
  if (!lastSeen) return "Last seen recently";

  const diffSeconds = Math.max(1, Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000));

  if (diffSeconds < 60) return "Last seen just now";
  if (diffSeconds < 3600) return `Last seen ${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `Last seen ${Math.floor(diffSeconds / 3600)}h ago`;
  return `Last seen ${Math.floor(diffSeconds / 86400)}d ago`;
};

const HOLD_DURATION_MS = 450;

const ChatRoom = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const messageScrollRef = useRef<HTMLElement | null>(null);

  const {
    users,
    profile,
    authUserId,
    getMessagesForUser,
    currentPing,
    appMode,
    handleSend,
    retryOfflineMessage,
    deleteOwnMessage,
    setMessageReaction,
    createOutgoingCallInvite,
  } = useSparkMesh();

  const [draftText, setDraftText] = useState("");
  const [draftAttachment, setDraftAttachment] = useState<AttachmentPayload | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused" | "ready">("idle");
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [voiceDraft, setVoiceDraft] = useState<AttachmentPayload | null>(null);
  const [isAppOnline, setIsAppOnline] = useState(() => navigator.onLine);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [starredMessageIds, setStarredMessageIds] = useState<string[]>([]);
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [starredDialogOpen, setStarredDialogOpen] = useState(false);

  const { bindPullToRefresh, isRefreshing, pullDistance, readyToRefresh } = usePullToRefresh({
    getScrollTop: () => messageScrollRef.current?.scrollTop ?? 0,
    onRefresh: () => {
      window.location.reload();
    },
  });
  

  const user = useMemo(() => users.find((entry) => entry.id === userId), [users, userId]);
  const chatPeerId = userId ?? "";
  const messages = userId ? getMessagesForUser(userId) : [];

  const chatStorageKeyBase = useMemo(() => {
    if (!userId) return null;
    const ownerId = authUserId ?? profile?.deviceId ?? "guest";
    return `sparkmesh_chat_meta_${ownerId}_${userId}`;
  }, [authUserId, profile?.deviceId, userId]);

  useEffect(() => {
    if (!userId) {
      navigate("/home", { replace: true });
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (!chatStorageKeyBase) return;

    try {
      const raw = localStorage.getItem(chatStorageKeyBase);
      if (!raw) {
        setStarredMessageIds([]);
        setPinnedMessageId(null);
        return;
      }

      const parsed = JSON.parse(raw) as {
        starred?: string[];
        pinned?: string | null;
      };

      setStarredMessageIds(Array.isArray(parsed.starred) ? parsed.starred : []);
      setPinnedMessageId(typeof parsed.pinned === "string" ? parsed.pinned : null);
    } catch {
      setStarredMessageIds([]);
      setPinnedMessageId(null);
    }
  }, [chatStorageKeyBase]);

  useEffect(() => {
    if (!chatStorageKeyBase) return;

    localStorage.setItem(
      chatStorageKeyBase,
      JSON.stringify({
        starred: starredMessageIds,
        pinned: pinnedMessageId,
      })
    );
  }, [chatStorageKeyBase, pinnedMessageId, starredMessageIds]);

  useEffect(() => {
    if (!selectedMessageIds.length) return;
    const messageIds = new Set(messages.map((entry) => entry.id));
    setSelectedMessageIds((prev) => prev.filter((id) => messageIds.has(id)));
  }, [messages, selectedMessageIds.length]);

  useEffect(() => {
    if (!draftAttachment) {
      setUploadProgress(0);
      return;
    }

    let frameId = 0;
    let previousTimestamp = performance.now();

    const animateProgress = (timestamp: number) => {
      const delta = timestamp - previousTimestamp;
      previousTimestamp = timestamp;

      setUploadProgress((prev) => {
        const next = Math.min(100, prev + delta * 0.08);
        if (next < 100) {
          frameId = requestAnimationFrame(animateProgress);
        }
        return next;
      });
    };

    frameId = requestAnimationFrame(animateProgress);
    return () => cancelAnimationFrame(frameId);
  }, [draftAttachment]);

  useEffect(() => {
    if (recordingState !== "recording") return;

    const timerId = window.setInterval(() => {
      setRecordedDuration((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [recordingState]);

  useEffect(() => {
    return () => {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsAppOnline(true);
    const handleOffline = () => setIsAppOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const messageIds = new Set(messages.map((entry) => entry.id));
    setStarredMessageIds((prev) => prev.filter((id) => messageIds.has(id)));
    setPinnedMessageId((prev) => (prev && messageIds.has(prev) ? prev : null));
  }, [messages]);

  

  const clearHoldTimer = () => {
    if (!holdTimerRef.current) return;
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  const beginHold = (messageId: string) => {
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      setSelectedMessageIds([messageId]);
    }, HOLD_DURATION_MS);
  };

  const cancelHold = () => {
    clearHoldTimer();
  };

  const toggleSelectedMessage = (messageId: string) => {
    setSelectedMessageIds((prev) => (prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]));
  };

  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    const nextAttachment: AttachmentPayload = {
      id: crypto.randomUUID(),
      name: selected.name,
      type: selected.type,
      size: selected.size,
      url: URL.createObjectURL(selected),
      progress: 0,
    };

    setDraftAttachment(nextAttachment);
    setUploadProgress(0);
    event.target.value = "";
  };

  const onSend = () => {
    const text = draftText.trim();
    if (!text && !draftAttachment) return;

    handleSend(chatPeerId, {
      text,
      attachment: draftAttachment ? { ...draftAttachment, progress: uploadProgress } : undefined,
    });

    setDraftText("");
    setDraftAttachment(null);
    setUploadProgress(0);
  };

  const startCall = async () => {
    const callPayload = await createOutgoingCallInvite(chatPeerId, user?.uniqueId, "video");
    if (!callPayload) return;

    navigate(`/call/${encodeURIComponent(callPayload.callRoomID)}`, {
      state: {
        ...callPayload,
        returnTo: `/chat/${chatPeerId}`,
      },
    });
  };

  const startVoiceRecording = async () => {
    if (recordingState !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      setRecordedDuration(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const nextVoiceDraft: AttachmentPayload = {
          id: crypto.randomUUID(),
          name: `voice-note-${Date.now()}.webm`,
          type: audioBlob.type || "audio/webm",
          size: audioBlob.size,
          url: URL.createObjectURL(audioBlob),
          progress: 100,
        };
        setVoiceDraft(nextVoiceDraft);
        setRecordingState("ready");
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };

      recorder.start();
      setRecordingState("recording");
    } catch {
      setRecordingState("idle");
    }
  };

  const pauseOrResumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recordingState === "recording") {
      recorder.pause();
      setRecordingState("paused");
      return;
    }

    if (recordingState === "paused") {
      recorder.resume();
      setRecordingState("recording");
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingState === "recording" || recordingState === "paused") {
      recorder.stop();
    }
  };

  const sendVoiceRecording = () => {
    if (!voiceDraft) return;

    handleSend(chatPeerId, {
      attachment: voiceDraft,
    });

    setVoiceDraft(null);
    setRecordedDuration(0);
    setRecordingState("idle");
  };

  const cancelVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && (recordingState === "recording" || recordingState === "paused")) {
      recorder.onstop = null;
      recorder.stop();
    }

    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;

    if (voiceDraft?.url) {
      URL.revokeObjectURL(voiceDraft.url);
    }

    setVoiceDraft(null);
    setRecordedDuration(0);
    setRecordingState("idle");
  };

  const selectedMessages = useMemo(
    () => selectedMessageIds.map((id) => messages.find((entry) => entry.id === id)).filter((entry): entry is SparkMeshMessage => Boolean(entry)),
    [messages, selectedMessageIds]
  );
  const selectedMessageSet = useMemo(() => new Set(selectedMessageIds), [selectedMessageIds]);
  const singleSelectedMessage = selectedMessages.length === 1 ? selectedMessages[0] : null;
  const canDeleteSelected = selectedMessages.some((entry) => entry.direction === "sent");
  const allSelectedStarred = selectedMessages.length > 0 && selectedMessages.every((entry) => starredMessageIds.includes(entry.id));

  const applyReaction = async (emoji: string) => {
    if (!singleSelectedMessage) return;
    const applied = await setMessageReaction(chatPeerId, singleSelectedMessage.id, emoji);
    if (!applied) return;
    setSelectedMessageIds([]);
  };

  const togglePinForSingle = () => {
    if (!singleSelectedMessage) return;
    setPinnedMessageId((prev) => (prev === singleSelectedMessage.id ? null : singleSelectedMessage.id));
    setSelectedMessageIds([]);
  };

  const toggleStarForSelected = () => {
    if (selectedMessages.length === 0) return;

    setStarredMessageIds((prev) => {
      const next = new Set(prev);
      if (allSelectedStarred) {
        selectedMessages.forEach((entry) => next.delete(entry.id));
      } else {
        selectedMessages.forEach((entry) => next.add(entry.id));
      }
      return Array.from(next);
    });

    setSelectedMessageIds([]);
  };

  const deleteSelectedMessages = async () => {
    if (selectedMessages.length === 0) return;

    const ownMessageIds = selectedMessages.filter((entry) => entry.direction === "sent").map((entry) => entry.id);
    if (ownMessageIds.length === 0) return;

    const deletedResults = await Promise.all(ownMessageIds.map((messageId) => deleteOwnMessage(chatPeerId, messageId)));
    const deletedIds = ownMessageIds.filter((_, index) => deletedResults[index]);
    if (deletedIds.length === 0) return;

    const deletedIdSet = new Set(deletedIds);
    setStarredMessageIds((prev) => prev.filter((id) => !deletedIdSet.has(id)));
    setPinnedMessageId((prev) => (prev && deletedIdSet.has(prev) ? null : prev));
    setSelectedMessageIds([]);
  };


  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return messages;

    return messages.filter((entry) => {
      const textMatch = entry.text?.toLowerCase().includes(query);
      const attachmentMatch = entry.attachment?.name.toLowerCase().includes(query);
      return Boolean(textMatch || attachmentMatch);
    });
  }, [searchQuery, messages]);

  const pinnedMessage = useMemo(() => messages.find((entry) => entry.id === pinnedMessageId) ?? null, [pinnedMessageId, messages]);

  const starredMessages = useMemo(
    () => starredMessageIds.map((id) => messages.find((entry) => entry.id === id)).filter((entry): entry is SparkMeshMessage => Boolean(entry)),
    [messages, starredMessageIds]
  );

  if (!user || !userId || !chatPeerId) {
    return (
      <main className="app-wallpaper-bg mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-background">
        <header className="sticky top-0 z-20 flex items-center gap-2 bg-primary px-3 py-2 text-primary-foreground shadow-card">
          <button className="rounded-full p-2 transition hover:bg-primary-foreground/10" onClick={() => navigate("/home")}> 
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-medium">Loading chat…</p>
        </header>
      </main>
    );
  }

  const showTextSend = Boolean(draftText.trim() || draftAttachment);
  const peerRecentlySeen = Boolean(user.lastSeen && Date.now() - new Date(user.lastSeen).getTime() < 45000);
  const isPeerOnline =
    appMode === "online"
      ? isAppOnline && Boolean(user.onlineStatus || peerRecentlySeen)
      : Boolean(user.source === "wifi-direct" || user.onlineStatus || peerRecentlySeen);
  const pingValue = isPeerOnline ? currentPing : 999;
  const signalQuality = isPeerOnline ? getSignalQuality(pingValue) : "offline";

  const signalTextByQuality: Record<typeof signalQuality, string> = {
    weak: "Weak",
    stable: "Stable",
    excellent: "Excellent",
    offline: "Offline",
  };

  const statusTextClass = isPeerOnline ? "text-signal-excellent" : "text-destructive";
  const lastSeenLabel = getLastSeenLabel(user.lastSeen);

  return (
    <main className="app-wallpaper-bg mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-20 shrink-0 bg-primary px-3 py-2 text-primary-foreground shadow-card">
        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 transition hover:bg-primary-foreground/10" onClick={() => navigate("/home")}>
            <ArrowLeft className="h-5 w-5" />
          </button>

          <Avatar className="h-10 w-10 border border-primary-foreground/30">
            <AvatarImage alt={`${user.name} profile`} src={user.avatarUrl ?? getAvatarTemplateBySeed(user.uniqueId ?? user.name).dataUrl} />
            <AvatarFallback className="bg-avatar-ring text-sm font-semibold text-primary">{user.name.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className={`text-xs ${statusTextClass}`}>
              {appMode === "online"
                ? isPeerOnline
                  ? "Online"
                  : `Offline • ${lastSeenLabel}`
                : isPeerOnline
                  ? `Nearby • ${pingValue}ms • ${signalTextByQuality[signalQuality]}`
                  : `Offline • --ms • ${lastSeenLabel}`}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button className="rounded-full p-2 transition hover:bg-primary-foreground/10" onClick={() => void startCall()}>
              <Phone className="h-5 w-5" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full p-2 transition hover:bg-primary-foreground/10" type="button">
                  <EllipsisVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    setSearchOpen(true);
                  }}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search messages
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setStarredDialogOpen(true);
                  }}
                >
                  <Star className="mr-2 h-4 w-4" />
                  Starred messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {searchOpen && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-primary-foreground/10 p-2">
            <Input
              className="h-9 border-primary-foreground/30 bg-background text-foreground"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search messages"
              value={searchQuery}
            />
            <Button
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </header>

      {(pullDistance > 0 || isRefreshing) && (
        <div className="mx-3 mt-2 rounded-full border border-border bg-card px-3 py-1 text-center text-xs text-muted-foreground shadow-sm">
          {isRefreshing ? "Refreshing app..." : readyToRefresh ? "Release to refresh" : "Pull down to refresh"}
        </div>
      )}

      {pinnedMessage && (
        <div className="mx-3 mt-2 rounded-xl border border-border bg-card p-2 text-sm shadow-sm">
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Pin className="h-3.5 w-3.5" />
            Pinned message
          </div>
          <p className="truncate text-foreground">{pinnedMessage.text || pinnedMessage.attachment?.name || "Attachment"}</p>
        </div>
      )}

      <section
        {...bindPullToRefresh}
        className="chat-doodle-bg min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
        ref={messageScrollRef}
      >
        {filteredMessages.map((message) => {
          const isSelected = selectedMessageSet.has(message.id);
          const isPinned = pinnedMessageId === message.id;
          const isStarred = starredMessageIds.includes(message.id);
          const reaction = message.reactionEmoji;

          return (
            <div
              className={`rounded-xl transition ${isSelected ? "bg-muted/60 p-1" : ""}`}
              key={message.id}
              onClick={() => {
                if (!selectedMessageIds.length) return;
                toggleSelectedMessage(message.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setSelectedMessageIds([message.id]);
              }}
              onMouseDown={() => beginHold(message.id)}
              onMouseLeave={cancelHold}
              onMouseUp={cancelHold}
              onTouchEnd={cancelHold}
              onTouchStart={() => beginHold(message.id)}
            >
              <MessageBubble message={message} onRetry={(messageId) => void retryOfflineMessage(chatPeerId, messageId)} />

              {(isPinned || isStarred || reaction) && (
                <div className={`mt-1 flex items-center gap-1 px-2 ${message.direction === "sent" ? "justify-end" : "justify-start"}`}>
                  {isPinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Pin className="h-3 w-3" />
                      Pinned
                    </span>
                  )}
                  {isStarred && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Star className="h-3 w-3" />
                      Starred
                    </span>
                  )}
                  {reaction && <span className="rounded-full bg-muted px-2 py-0.5 text-sm">{reaction}</span>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <footer className="sticky bottom-0 z-20 shrink-0 space-y-2 border-t border-border bg-card p-2">
        {selectedMessages.length > 0 && (
          <MessageHoldActions
            canDelete={canDeleteSelected}
            canReact={Boolean(singleSelectedMessage)}
            isPinned={Boolean(singleSelectedMessage && pinnedMessageId === singleSelectedMessage.id)}
            isStarred={allSelectedStarred}
            onCancel={() => setSelectedMessageIds([])}
            onDelete={() => void deleteSelectedMessages()}
            onReact={applyReaction}
            onTogglePin={togglePinForSingle}
            onToggleStar={toggleStarForSelected}
            selectedCount={selectedMessages.length}
            showPin={Boolean(singleSelectedMessage)}
          />
        )}

        {draftAttachment && (
          <div className="rounded-xl border border-border bg-muted p-2">
            <p className="truncate text-xs font-medium text-foreground">{draftAttachment.name}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {recordingState !== "idle" && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/50 p-2">
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-foreground">
                {recordingState === "ready" ? "Voice note ready" : recordingState === "paused" ? "Recording paused" : "Recording voice..."}
              </p>
              <p className="font-mono text-muted-foreground">{formatTimer(recordedDuration)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button className="gap-1 dark:text-foreground" onClick={cancelVoiceRecording} size="sm" type="button" variant="outline">
                Cancel
              </Button>
              {recordingState === "ready" ? (
                <Button
                  className="gap-1 dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]"
                  onClick={sendVoiceRecording}
                  size="sm"
                  type="button"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                  Send
                </Button>
              ) : (
                <Button className="gap-1 dark:text-foreground dark:ring-1 dark:ring-accent/35" onClick={pauseOrResumeRecording} size="sm" type="button" variant="secondary">
                  {recordingState === "recording" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {recordingState === "recording" ? "Pause" : "Resume"}
                </Button>
              )}
              <Button
                className="gap-1 dark:text-foreground dark:ring-1 dark:ring-accent/35"
                disabled={recordingState === "ready"}
                onClick={stopVoiceRecording}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-muted/70 p-1.5 shadow-sm">
          <div className="flex items-center gap-1">
            <Button className="dark:text-foreground" onClick={() => fileInputRef.current?.click()} size="icon" type="button" variant="ghost">
              <Paperclip className="h-5 w-5" />
            </Button>

            <Input
              className="border-border/60 bg-background"
              disabled={recordingState !== "idle"}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Type a message"
              value={draftText}
            />

            <Button className="dark:text-foreground" onClick={() => cameraInputRef.current?.click()} size="icon" type="button" variant="ghost">
              <Camera className="h-5 w-5" />
            </Button>

            {showTextSend ? (
              <Button className="dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]" onClick={onSend} size="icon" type="button">
                <SendHorizontal className="h-5 w-5" />
              </Button>
            ) : (
              <Button className="dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]" disabled={recordingState !== "idle"} onClick={startVoiceRecording} size="icon" type="button">
                <Mic className="h-5 w-5" />
              </Button>
            )}

            <input className="hidden" onChange={onFilePicked} ref={fileInputRef} type="file" />
            <input accept="image/*" capture="environment" className="hidden" onChange={onFilePicked} ref={cameraInputRef} type="file" />
          </div>
        </div>
      </footer>

      <Dialog onOpenChange={setStarredDialogOpen} open={starredDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Starred messages</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
            {starredMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No starred messages yet.</p>
            ) : (
              starredMessages.map((message) => (
                <button
                  className="w-full rounded-xl border border-border bg-card p-2 text-left transition hover:bg-muted"
                  key={message.id}
                  onClick={() => {
                    setSelectedMessageIds([message.id]);
                    setStarredDialogOpen(false);
                  }}
                  type="button"
                >
                  <p className="line-clamp-2 text-sm text-foreground">{message.text || message.attachment?.name || "Attachment"}</p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

    </main>
  );
};

export default ChatRoom;
