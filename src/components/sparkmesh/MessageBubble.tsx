import { AlertCircle, Check, CheckCheck, FileArchive, FileAudio, FileImage, FileText, LoaderCircle, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatTime12 } from "@/lib/time-format";
import type { SparkMeshMessage } from "@/types/sparkmesh";

interface MessageBubbleProps {
  message: SparkMeshMessage;
  onRetry?: (messageId: string) => void;
}

const formatAudioTime = (value: number) => {
  if (!Number.isFinite(value)) return "00:00";
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const formatFileSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const converted = size / 1024 ** unitIndex;
  return `${converted >= 10 || unitIndex === 0 ? converted.toFixed(0) : converted.toFixed(1)} ${units[unitIndex]}`;
};

const getAttachmentTypeBadge = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "ARCHIVE";
  if (mimeType.includes("word") || mimeType.includes("document")) return "DOC";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "SHEET";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "SLIDES";
  return "FILE";
};

const getAttachmentTypeIcon = (mimeType: string) => {
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return FileArchive;
  return FileText;
};

const MessageBubble = ({ message, onRetry }: MessageBubbleProps) => {
  const isSent = message.direction === "sent";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const seekbarId = useId();

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const onLoadedMetadata = () => setDuration(audioElement.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audioElement.currentTime || 0);
    const onEnded = () => setIsPlaying(false);

    audioElement.addEventListener("loadedmetadata", onLoadedMetadata);
    audioElement.addEventListener("timeupdate", onTimeUpdate);
    audioElement.addEventListener("ended", onEnded);

    return () => {
      audioElement.removeEventListener("loadedmetadata", onLoadedMetadata);
      audioElement.removeEventListener("timeupdate", onTimeUpdate);
      audioElement.removeEventListener("ended", onEnded);
    };
  }, [message.id]);

  const togglePlayback = () => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      void audioElement.play();
      setIsPlaying(true);
    }
  };

  const onSeek = (value: number) => {
    const audioElement = audioRef.current;
    if (!audioElement) return;
    audioElement.currentTime = value;
    setCurrentTime(value);
  };

  const isAudioAttachment = Boolean(message.attachment && message.attachment.type.startsWith("audio/"));

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
          isSent ? "bg-message-sent text-foreground" : "bg-message-received text-foreground"
        }`}
      >
        {message.text && <p className="whitespace-pre-wrap text-sm">{message.text}</p>}

        {message.attachment && (
          <div className="mt-2 rounded-lg border border-border bg-background/40 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-foreground">{message.attachment.name}</p>
              <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                {(() => {
                  const AttachmentTypeIcon = getAttachmentTypeIcon(message.attachment.type);
                  return (
                    <span className="inline-flex items-center gap-1">
                      <AttachmentTypeIcon className="h-3 w-3" />
                      <span>
                        {getAttachmentTypeBadge(message.attachment.type)} • {formatFileSize(message.attachment.size)}
                      </span>
                    </span>
                  );
                })()}
              </span>
            </div>

            {isAudioAttachment ? (
              <div className="space-y-2">
                <audio preload="metadata" ref={audioRef} src={message.attachment.url} />
                <div className="flex items-center gap-2">
                  <button className="rounded-full bg-primary p-1.5 text-primary-foreground" onClick={togglePlayback} type="button">
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="sr-only" htmlFor={seekbarId}>
                    Voice note seekbar
                  </label>
                  <input
                    className="w-full accent-primary"
                    id={seekbarId}
                    max={duration || 0}
                    min={0}
                    onChange={(event) => onSeek(Number(event.target.value))}
                    step={0.1}
                    type="range"
                    value={Math.min(currentTime, duration || 0)}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{formatAudioTime(currentTime)}</span>
                  <span>{formatAudioTime(duration)}</span>
                </div>
              </div>
            ) : message.attachment.type.startsWith("image/") ? (
              <img
                alt={message.attachment.name}
                className="h-36 w-full rounded-md object-cover"
                loading="lazy"
                src={message.attachment.url}
              />
            ) : (
              <a
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                download={message.attachment.name}
                href={message.attachment.url}
                rel="noreferrer"
                target="_blank"
              >
                Open / Download file
              </a>
            )}
          </div>
        )}

        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          <span>{formatTime12(message.createdAt)}</span>
          {isSent && message.status === "sending" && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
          {isSent && message.status === "sent" && <Check className="h-3.5 w-3.5" />}
          {isSent && (message.status === "delivered" || message.status === "read") && (
            <CheckCheck className={`h-3.5 w-3.5 ${message.status === "read" ? "text-accent" : ""}`} />
          )}
          {isSent && message.status === "failed" && (
            <button
              className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive"
              onClick={() => onRetry?.(message.id)}
              type="button"
            >
              <AlertCircle className="h-3 w-3" />
              Failed
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;

