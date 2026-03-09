export type CallStatus = "incoming" | "ringing" | "active";
export type CallMode = "voice" | "video";
export type AppMode = "online" | "offline";

export interface SparkMeshProfile {
  name: string;
  uniqueId?: string;
  deviceId: string;
  avatarUrl?: string;
}

export interface SparkMeshUser {
  id: string;
  name: string;
  uniqueId?: string;
  deviceId: string;
  avatarSeed: string;
  avatarUrl?: string;
  signalStrength?: number;
  rangeMeters?: number;
  onlineStatus?: boolean;
  lastSeen?: string | null;
  source?: "online" | "wifi-direct";
}

export interface IncomingAirTalkRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  requestMessage?: string;
  createdAt: string;
}

export interface IncomingCallInvite {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  callRoomID: string;
  callType: "video" | "voice";
  createdAt: string;
}

export interface CallHistoryEntry {
  id: string;
  peerUserId: string;
  peerName: string;
  peerAvatarUrl?: string;
  callRoomID: string;
  callType: "video" | "voice";
  direction: "incoming" | "outgoing";
  status: "completed" | "declined" | "missed";
  startedAt: string;
  durationSeconds?: number;
}

export interface AttachmentPayload {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  progress: number;
}

export interface SparkMeshMessage {
  id: string;
  chatUserId: string;
  direction: "sent" | "received";
  text?: string;
  attachment?: AttachmentPayload;
  reactionEmoji?: string;
  createdAt: string;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
}

export interface CallSession {
  open: boolean;
  status: CallStatus;
  mode: CallMode;
  userId: string | null;
}

