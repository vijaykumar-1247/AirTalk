import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import {
  endCallSession,
  handleSendMessage,
  initiateCall,
  startScan,
  toggleMuteTrack,
  toggleSpeakerOutput,
  toggleVideoTrack,
} from "@/lib/sparkmesh-backend";
import { handleAppError } from "@/lib/app-error";
import { prepareAttachmentForTransport } from "@/lib/low-data-mode";
import { buildDeterministicCallRoomId } from "@/lib/call-room";
import { getPlatformSyncedDeviceId } from "@/lib/device-id";
import { clearLocalProfileSnapshot, loadLocalProfileSnapshot, saveLocalProfileSnapshot } from "@/lib/local-auth-profile";
import { useAppSettings } from "@/context/AppSettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { WifiDirectTransport } from "@/plugins/wifi-direct-transport";
import {
  clearNativeIncomingCallNotification,
  initializeNativeCallNotifications,
  showNativeIncomingCallNotification,
} from "@/lib/native-call-notifications";
import type {
  AppMode,
  AttachmentPayload,
  CallHistoryEntry,
  CallMode,
  CallSession,
  IncomingAirTalkRequest,
  IncomingCallInvite,
  SparkMeshMessage,
  SparkMeshProfile,
  SparkMeshUser,
} from "@/types/sparkmesh";

const PERMISSIONS_KEY = "sparkmesh_permissions_complete";
const APP_MODE_KEY = "sparkmesh_app_mode";
const OFFLINE_USERS_KEY = "sparkmesh_offline_users_cache";
const MESSAGE_CACHE_KEY = "sparkmesh_messages_cache";

const randomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const loadCachedOfflineUsers = (): SparkMeshUser[] => {
  try {
    const raw = localStorage.getItem(OFFLINE_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SparkMeshUser => Boolean(entry?.id && entry?.name));
  } catch {
    return [];
  }
};

const loadCachedMessages = (): Record<string, SparkMeshMessage[]> => {
  try {
    const raw = localStorage.getItem(MESSAGE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, SparkMeshMessage[]>) : {};
  } catch {
    return {};
  }
};

const blobToDataUrl = async (blob: Blob) =>
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not serialize attachment"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });

const normalizeAttachmentForLocalStorage = async (attachment?: AttachmentPayload) => {
  if (!attachment) return undefined;
  if (!attachment.url.startsWith("blob:")) return attachment;

  try {
    const blob = await fetch(attachment.url).then((response) => response.blob());
    const dataUrl = await blobToDataUrl(blob);
    return {
      ...attachment,
      url: dataUrl,
      size: blob.size || attachment.size,
      type: blob.type || attachment.type,
    };
  } catch {
    return attachment;
  }
};

const mapProfile = (
  row: { display_name: string; unique_id?: string | null; device_id: string | null; avatar_url: string | null },
  fallbackDeviceId: string
): SparkMeshProfile => ({
  name: row.display_name,
  uniqueId: row.unique_id ?? undefined,
  deviceId: row.device_id ?? fallbackDeviceId ?? randomId(),
  avatarUrl: row.avatar_url ?? undefined,
});

const mapDiscoveredPeerToUser = (peer: unknown): SparkMeshUser | null => {
  if (!peer || typeof peer !== "object") return null;

  const candidate = peer as {
    peerId?: unknown;
    deviceName?: unknown;
    deviceAddress?: unknown;
    signalStrength?: unknown;
    rangeMeters?: unknown;
  };

  if (typeof candidate.peerId !== "string" || candidate.peerId.length === 0) return null;

  const safeName = typeof candidate.deviceName === "string" && candidate.deviceName.length > 0 ? candidate.deviceName : "Nearby device";
  const safeDeviceId = typeof candidate.deviceAddress === "string" && candidate.deviceAddress.length > 0 ? candidate.deviceAddress : candidate.peerId;
  const safeSignalStrength = typeof candidate.signalStrength === "number" ? candidate.signalStrength : undefined;
  const safeRangeMeters = typeof candidate.rangeMeters === "number" ? candidate.rangeMeters : undefined;

  return {
    id: candidate.peerId,
    name: safeName,
    deviceId: safeDeviceId,
    avatarSeed: safeName.toLowerCase(),
    signalStrength: safeSignalStrength,
    rangeMeters: safeRangeMeters,
    onlineStatus: true,
    lastSeen: new Date().toISOString(),
    source: "wifi-direct",
  };
};

export const useSparkMeshState = () => {
  const [profile, setProfile] = useState<SparkMeshProfile | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [permissionsCompleted, setPermissionsCompleted] = useState(() => localStorage.getItem(PERMISSIONS_KEY) === "true");
  const [appMode, setAppMode] = useState<AppMode>(() => (localStorage.getItem(APP_MODE_KEY) === "offline" ? "offline" : "online"));
  const [offlineCachedUsers, setOfflineCachedUsers] = useState<SparkMeshUser[]>(() => loadCachedOfflineUsers());
  const [users, setUsers] = useState<SparkMeshUser[]>([]);
  const [messagesByUser, setMessagesByUser] = useState<Record<string, SparkMeshMessage[]>>(() => loadCachedMessages());
  const [conversationByUser, setConversationByUser] = useState<Record<string, string>>({});
  const [incomingRequest, setIncomingRequest] = useState<IncomingAirTalkRequest | null>(null);
  const [incomingCallInvite, setIncomingCallInvite] = useState<IncomingCallInvite | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [currentPing, setCurrentPing] = useState<number>(24);
  const [scanOpen, setScanOpen] = useState(false);
  const [callSession, setCallSession] = useState<CallSession>({
    open: false,
    status: "ringing",
    mode: "voice",
    userId: null,
  });
  const [isMuted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const { isLowDataModeEnabled } = useAppSettings();

  const notifiedIncomingCallIdRef = useRef<string | null>(null);

  const cacheOfflineUsers = useCallback((nextUsers: SparkMeshUser[]) => {
    const wifiUsers = nextUsers.filter((entry) => entry.source === "wifi-direct");
    setOfflineCachedUsers(wifiUsers);
    localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(wifiUsers));
  }, []);

  const reconcileWifiDirectUsers = useCallback(
    (discoveredUsers: SparkMeshUser[]) => {
      setUsers((prev) => {
        const preservedUsers = prev.filter((entry) => entry.source !== "wifi-direct");
        const merged = new Map(preservedUsers.map((entry) => [entry.id, entry]));
        discoveredUsers.forEach((entry) => merged.set(entry.id, entry));
        const nextUsers = Array.from(merged.values());
        cacheOfflineUsers(nextUsers);
        return nextUsers;
      });
    },
    [cacheOfflineUsers]
  );

  useEffect(() => {
    localStorage.setItem(APP_MODE_KEY, appMode);
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem(MESSAGE_CACHE_KEY, JSON.stringify(messagesByUser));
  }, [messagesByUser]);

  const loadUsers = useCallback(async (currentUserId: string) => {
    const { data: contactRows } = await supabase.from("contacts").select("contact_id").eq("user_id", currentUserId);

    const contactIds = (contactRows ?? []).map((row) => row.contact_id);
    if (contactIds.length === 0) {
      setUsers([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, unique_id, device_id, avatar_url, online_status, last_seen")
      .in("user_id", contactIds)
      .order("updated_at", { ascending: false });

    setUsers(
      (profiles ?? []).map((entry) => ({
        id: entry.user_id,
        name: entry.display_name,
        uniqueId: entry.unique_id ?? undefined,
        deviceId: entry.device_id ?? "------",
        avatarSeed: entry.display_name.toLowerCase(),
        avatarUrl: entry.avatar_url ?? undefined,
        onlineStatus: entry.online_status,
        lastSeen: entry.last_seen,
        source: "online",
      }))
    );
  }, []);

  const refreshUsers = useCallback(async () => {
    if (!authUserId) return;
    await loadUsers(authUserId);
  }, [authUserId, loadUsers]);

  const loadMessagesForCurrentUser = useCallback(async (currentUserId: string) => {
    const { data: ownParticipantData } = await supabase
      .from("conversation_participants")
      .select("conversation_id, cleared_at")
      .eq("user_id", currentUserId);

    const ownParticipantRows = (ownParticipantData ?? []) as Array<{ conversation_id: string; cleared_at: string | null }>;
    const ownConversationIds = ownParticipantRows.map((row) => row.conversation_id);

    if (ownConversationIds.length === 0) {
      setConversationByUser({});
      setMessagesByUser({});
      return;
    }

    const { data: participantRows } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", ownConversationIds);

    const byConversation = new Map<string, string>();
    (participantRows ?? []).forEach((row) => {
      if (row.user_id !== currentUserId) {
        byConversation.set(row.conversation_id, row.user_id);
      }
    });

    const userConversationMap = Object.fromEntries(Array.from(byConversation.entries()).map(([conversationId, userId]) => [userId, conversationId]));
    setConversationByUser((prev) => {
      const prevEntries = Object.entries(prev);
      const nextEntries = Object.entries(userConversationMap);
      if (prevEntries.length === nextEntries.length && nextEntries.every(([key, value]) => prev[key] === value)) {
        return prev;
      }
      return userConversationMap;
    });

    const conversationIds = Array.from(byConversation.keys());
    if (conversationIds.length === 0) {
      setMessagesByUser({});
      return;
    }

    const clearedAtByConversation = new Map<string, number>();
    ownParticipantRows.forEach((row) => {
      if (row.cleared_at) {
        clearedAtByConversation.set(row.conversation_id, new Date(row.cleared_at).getTime());
      }
    });

    const { data: messageRows } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, reaction_emoji, created_at, attachment:attachments(id, file_name, mime_type, file_size, file_path)")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });

    const grouped: Record<string, SparkMeshMessage[]> = {};

    const attachmentRows = (messageRows ?? [])
      .map((row) =>
        row.attachment as
          | { id: string; file_name: string; mime_type: string; file_size: number; file_path: string }
          | null
      )
      .filter((entry): entry is { id: string; file_name: string; mime_type: string; file_size: number; file_path: string } => Boolean(entry));

    const uniquePaths = Array.from(new Set(attachmentRows.map((entry) => entry.file_path)));
    const signedUrlByPath = new Map<string, string>();

    await Promise.all(
      uniquePaths.map(async (path) => {
        const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(path, 3600);
        signedUrlByPath.set(path, signed?.signedUrl ?? "");
      })
    );

    for (const row of messageRows ?? []) {
      const userId = byConversation.get(row.conversation_id);
      if (!userId) continue;

      const clearedAtMs = clearedAtByConversation.get(row.conversation_id);
      if (typeof clearedAtMs === "number" && new Date(row.created_at).getTime() <= clearedAtMs) {
        continue;
      }

      const attachmentRow = row.attachment as
        | { id: string; file_name: string; mime_type: string; file_size: number; file_path: string }
        | null;

      let attachment: AttachmentPayload | undefined;
      if (attachmentRow) {
        attachment = {
          id: attachmentRow.id,
          name: attachmentRow.file_name,
          type: attachmentRow.mime_type,
          size: attachmentRow.file_size,
          url: signedUrlByPath.get(attachmentRow.file_path) ?? "",
          progress: 100,
        };
      }

      const mapped: SparkMeshMessage = {
        id: row.id,
        chatUserId: userId,
        direction: row.sender_id === currentUserId ? "sent" : "received",
        text: row.content ?? undefined,
        reactionEmoji: row.reaction_emoji ?? undefined,
        attachment,
        createdAt: row.created_at,
        status: "read",
      };

      grouped[userId] = [...(grouped[userId] ?? []), mapped];
    }

    setMessagesByUser(grouped);
  }, []);

  const mapInviteToBanner = useCallback(
    async (invite: {
      id: string;
      sender_id: string;
      call_room_id: string;
      call_type: string;
      created_at: string;
      expires_at?: string;
      status?: string;
    }) => {
      if (invite.status && invite.status !== "pending") {
        setIncomingCallInvite((prev) => (prev?.id === invite.id ? null : prev));
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
        setIncomingCallInvite((prev) => (prev?.id === invite.id ? null : prev));
        return;
      }

      const { data: sender } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", invite.sender_id)
        .maybeSingle();

      setIncomingCallInvite({
        id: invite.id,
        senderId: invite.sender_id,
        senderName: sender?.display_name ?? "Unknown user",
        senderAvatarUrl: sender?.avatar_url ?? undefined,
        callRoomID: invite.call_room_id,
        callType: invite.call_type === "voice" ? "voice" : "video",
        createdAt: invite.created_at,
      });
    },
    []
  );

  const loadPendingIncomingCall = useCallback(
    async (currentUserId: string) => {
      const { data: latestPending } = await supabase
        .from("call_invites")
        .select("id, sender_id, call_room_id, call_type, created_at, expires_at, status")
        .eq("receiver_id", currentUserId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestPending) {
        setIncomingCallInvite(null);
        return;
      }

      await mapInviteToBanner(latestPending);
    },
    [mapInviteToBanner]
  );

  const loadCallHistory = useCallback(async (currentUserId: string) => {
    const { data: historyRows } = await supabase
      .from("call_history")
      .select("id, peer_user_id, call_room_id, call_type, direction, status, started_at, duration_seconds")
      .eq("user_id", currentUserId)
      .order("started_at", { ascending: false })
      .limit(50);

    if (!historyRows || historyRows.length === 0) {
      setCallHistory([]);
      return;
    }

    const peerIds = Array.from(new Set(historyRows.map((entry) => entry.peer_user_id)));
    const { data: peers } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", peerIds);

    const peerMap = new Map((peers ?? []).map((peer) => [peer.user_id, { name: peer.display_name, avatar: peer.avatar_url }]));

    setCallHistory(
      historyRows.map((entry) => ({
        id: entry.id,
        peerUserId: entry.peer_user_id,
        peerName: peerMap.get(entry.peer_user_id)?.name ?? "Unknown user",
        peerAvatarUrl: peerMap.get(entry.peer_user_id)?.avatar ?? undefined,
        callRoomID: entry.call_room_id,
        callType: entry.call_type === "voice" ? "voice" : "video",
        direction: entry.direction === "incoming" ? "incoming" : "outgoing",
        status: entry.status === "declined" ? "declined" : entry.status === "missed" ? "missed" : "completed",
        startedAt: entry.started_at,
        durationSeconds: entry.duration_seconds ?? undefined,
      }))
    );
  }, []);

  const addCallHistoryEntry = useCallback(
    async (payload: {
      peerUserId: string;
      callRoomID: string;
      callType: "video" | "voice";
      direction: "incoming" | "outgoing";
      status: "completed" | "declined" | "missed";
      startedAt?: string;
      endedAt?: string;
      durationSeconds?: number;
    }) => {
      if (!authUserId) return;

      await supabase.from("call_history").insert({
        user_id: authUserId,
        peer_user_id: payload.peerUserId,
        call_room_id: payload.callRoomID,
        call_type: payload.callType,
        direction: payload.direction,
        status: payload.status,
        started_at: payload.startedAt ?? new Date().toISOString(),
        ended_at: payload.endedAt ?? null,
        duration_seconds: payload.durationSeconds ?? null,
      });

      await loadCallHistory(authUserId);
    },
    [authUserId, loadCallHistory]
  );

  useEffect(() => {
    let requestChannel: ReturnType<typeof supabase.channel> | null = null;
    let callInviteChannel: ReturnType<typeof supabase.channel> | null = null;
    let callHistoryChannel: ReturnType<typeof supabase.channel> | null = null;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    let contactsChannel: ReturnType<typeof supabase.channel> | null = null;
    let messageChannel: ReturnType<typeof supabase.channel> | null = null;
    let participantChannel: ReturnType<typeof supabase.channel> | null = null;
    let peersListener: PluginListenerHandle | null = null;
    let messageListener: PluginListenerHandle | null = null;

    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUserId = session?.user.id;
      if (!currentUserId) {
        const localProfile = loadLocalProfileSnapshot();
        setAuthUserId(null);
        setProfile(localProfile);
        await Preferences.set({ key: 'profile', value: JSON.stringify(localProfile) });
        setAppMode("offline");
        setIsInitializing(false);
        return;
      }
      setAuthUserId(currentUserId);
      const syncedDeviceId = getPlatformSyncedDeviceId();

      const { data: ownProfile } = await supabase
        .from("profiles")
        .select("display_name, unique_id, device_id, avatar_url")
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (ownProfile) {
        if (ownProfile.device_id !== syncedDeviceId) {
          await supabase.from("profiles").update({ device_id: syncedDeviceId }).eq("user_id", currentUserId);
        }

        const mappedProfile = mapProfile({ ...ownProfile, device_id: syncedDeviceId }, syncedDeviceId);
        setProfile(mappedProfile);
        await Preferences.set({ key: 'profile', value: JSON.stringify(mappedProfile) });
        saveLocalProfileSnapshot(mappedProfile, "online");
      }

      await loadUsers(currentUserId);
      await loadMessagesForCurrentUser(currentUserId);
      await loadCallHistory(currentUserId);

      if (Capacitor.isPluginAvailable("WifiDirectTransport")) {
        try {
        peersListener = await WifiDirectTransport.addListener("peersUpdated", (event) => {
          const discoveredUsers = (event.peers ?? [])
            .map(mapDiscoveredPeerToUser)
            .filter((entry): entry is SparkMeshUser => entry !== null);

          reconcileWifiDirectUsers(discoveredUsers);
        });

        messageListener = await WifiDirectTransport.addListener("messageReceived", (event) => {
          if (!event.fromPeerId) return;

          const timestamp = Number(event.receivedAt);
          const createdAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
          const mimeType = event.mimeType?.trim() || "application/octet-stream";
          const attachmentName = event.attachmentName?.trim() || `attachment-${Date.now()}`;
          const attachmentBase64 = event.attachmentBase64?.trim();

          const attachment = attachmentBase64
            ? {
                id: crypto.randomUUID(),
                name: attachmentName,
                type: mimeType,
                size: Math.floor((attachmentBase64.length * 3) / 4),
                url: `data:${mimeType};base64,${attachmentBase64}`,
                progress: 100,
              }
            : undefined;

          const incomingMessage: SparkMeshMessage = {
            id: crypto.randomUUID(),
            chatUserId: event.fromPeerId,
            direction: "received",
            text: event.text,
            attachment,
            createdAt,
            status: "read",
          };

          setMessagesByUser((prev) => ({
            ...prev,
            [event.fromPeerId]: [...(prev[event.fromPeerId] ?? []), incomingMessage],
          }));

          setUsers((prev) => {
            if (prev.some((user) => user.id === event.fromPeerId)) return prev;

            const shortId = event.fromPeerId.slice(0, 8).toUpperCase();
            const newNearbyUser: SparkMeshUser = {
              id: event.fromPeerId,
              name: `Nearby ${shortId}`,
              deviceId: event.fromPeerId,
              avatarSeed: shortId.toLowerCase(),
              onlineStatus: true,
              lastSeen: createdAt,
              source: "wifi-direct",
            };

            const nextUsers = [newNearbyUser, ...prev];
            cacheOfflineUsers(nextUsers);
            return nextUsers;
          });
        });
        } catch {
          // Native plugin not available on web preview.
        }
      }

      requestChannel = supabase
        .channel(`incoming-requests-${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "contact_requests", filter: `receiver_id=eq.${currentUserId}` },
          async (payload) => {
            const senderId = payload.new.sender_id as string;
            const { data: sender } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("user_id", senderId)
              .maybeSingle();

            setIncomingRequest({
              id: payload.new.id as string,
              senderId,
              senderName: sender?.display_name ?? "Unknown user",
              senderAvatarUrl: sender?.avatar_url ?? undefined,
              requestMessage: (payload.new.request_message as string | null) ?? undefined,
              createdAt: payload.new.created_at as string,
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "contact_requests", filter: `receiver_id=eq.${currentUserId}` },
          async (payload) => {
            const nextStatus = payload.new.status as string;
            if (nextStatus === "accepted") {
              await loadUsers(currentUserId);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "contact_requests", filter: `sender_id=eq.${currentUserId}` },
          async (payload) => {
            const nextStatus = payload.new.status as string;
            if (nextStatus === "accepted") {
              await loadUsers(currentUserId);
            }
          }
        )
        .subscribe();

      await loadPendingIncomingCall(currentUserId);

      callInviteChannel = supabase
        .channel(`call-invites-${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "call_invites", filter: `receiver_id=eq.${currentUserId}` },
          async (payload) => {
            if (payload.eventType === "DELETE") {
              const removedId = payload.old.id as string;
              setIncomingCallInvite((prev) => (prev?.id === removedId ? null : prev));
              return;
            }

            await mapInviteToBanner({
              id: payload.new.id as string,
              sender_id: payload.new.sender_id as string,
              call_room_id: payload.new.call_room_id as string,
              call_type: payload.new.call_type as string,
              created_at: payload.new.created_at as string,
              expires_at: payload.new.expires_at as string,
              status: payload.new.status as string,
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "call_invites", filter: `sender_id=eq.${currentUserId}` },
          async (payload) => {
            const nextStatus = payload.new.status as string;
            if (nextStatus !== "declined") return;

            await addCallHistoryEntry({
              peerUserId: payload.new.receiver_id as string,
              callRoomID: payload.new.call_room_id as string,
              callType: (payload.new.call_type as string) === "voice" ? "voice" : "video",
              direction: "outgoing",
              status: "declined",
              startedAt: payload.new.created_at as string,
            });
          }
        )
        .subscribe();

      callHistoryChannel = supabase
        .channel(`call-history-${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "call_history", filter: `user_id=eq.${currentUserId}` },
          async () => {
            await loadCallHistory(currentUserId);
          }
        )
        .subscribe();

      profileChannel = supabase
        .channel(`profiles-${currentUserId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async () => {
          await loadUsers(currentUserId);
        })
        .subscribe();

      contactsChannel = supabase
        .channel(`contacts-${currentUserId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "contacts", filter: `user_id=eq.${currentUserId}` }, async () => {
          await loadUsers(currentUserId);
        })
        .subscribe();

      messageChannel = supabase
        .channel(`messages-${currentUserId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async () => {
          await loadMessagesForCurrentUser(currentUserId);
        })
        .subscribe();

      participantChannel = supabase
        .channel(`conversation-participants-${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `user_id=eq.${currentUserId}` },
          async () => {
            await loadMessagesForCurrentUser(currentUserId);
          }
        )
        .subscribe();
    };

    setIsInitializing(false);

    void bootstrap();

    return () => {
      if (requestChannel) supabase.removeChannel(requestChannel);
      if (callInviteChannel) supabase.removeChannel(callInviteChannel);
      if (callHistoryChannel) supabase.removeChannel(callHistoryChannel);
      if (profileChannel) supabase.removeChannel(profileChannel);
      if (contactsChannel) supabase.removeChannel(contactsChannel);
      if (messageChannel) supabase.removeChannel(messageChannel);
      if (participantChannel) supabase.removeChannel(participantChannel);
      if (peersListener) void peersListener.remove();
      if (messageListener) void messageListener.remove();
    };
  }, [addCallHistoryEntry, cacheOfflineUsers, loadCallHistory, loadMessagesForCurrentUser, loadPendingIncomingCall, loadUsers, mapInviteToBanner, reconcileWifiDirectUsers]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    if (!incomingCallInvite) {
      notifiedIncomingCallIdRef.current = null;
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (document.visibilityState === "visible") return;
    if (notifiedIncomingCallIdRef.current === incomingCallInvite.id) return;

    const notificationTitle = incomingCallInvite.callType === "voice" ? "Incoming audio call" : "Incoming video call";
    const notificationBody = `${incomingCallInvite.senderName} is calling you. Open AirTalk to accept or decline.`;

    const showNotification = () => {
      const notification = new Notification(notificationTitle, {
        body: notificationBody,
        tag: `incoming-call-${incomingCallInvite.id}`,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      window.setTimeout(() => notification.close(), 10000);
      notifiedIncomingCallIdRef.current = incomingCallInvite.id;
    };

    if (Notification.permission === "granted") {
      showNotification();
      return;
    }

    if (Notification.permission === "default") {
      void Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          showNotification();
        }
      });
    }
  }, [incomingCallInvite]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const syncNativeIncomingCallNotification = async () => {
      await initializeNativeCallNotifications();
      if (cancelled) return;

      if (incomingCallInvite) {
        await showNativeIncomingCallNotification(incomingCallInvite);
        return;
      }

      await clearNativeIncomingCallNotification();
    };

    void syncNativeIncomingCallNotification();

    return () => {
      cancelled = true;
      if (incomingCallInvite) {
        void clearNativeIncomingCallNotification(incomingCallInvite.id);
      }
    };
  }, [incomingCallInvite]);

  useEffect(() => {
    if (!authUserId) return;

    const touchPresence = async (online: boolean) => {
      await supabase
        .from("profiles")
        .update({ online_status: online, last_seen: new Date().toISOString() })
        .eq("user_id", authUserId);
    };

    if (appMode !== "online") {
      void touchPresence(false);
      return;
    }

    void touchPresence(true);
    const heartbeat = window.setInterval(() => {
      void touchPresence(true);
    }, 15000);

    const onUnload = () => {
      void touchPresence(false);
    };

    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.clearInterval(heartbeat);
      void touchPresence(false);
    };
  }, [appMode, authUserId]);

  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: {
        rtt?: number;
        addEventListener?: (type: "change", listener: () => void) => void;
        removeEventListener?: (type: "change", listener: () => void) => void;
      };
    }).connection;

    const updatePing = () => {
      if (!navigator.onLine) {
        setCurrentPing(999);
        return;
      }

      const rtt = connection?.rtt;
      if (typeof rtt === "number" && Number.isFinite(rtt) && rtt > 0) {
        setCurrentPing(Math.round(rtt));
        return;
      }

      setCurrentPing((prev) => (prev >= 999 ? 120 : prev));
    };

    updatePing();

    const onOnline = () => updatePing();
    const onOffline = () => setCurrentPing(999);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    connection?.addEventListener?.("change", updatePing);

    const pingInterval = window.setInterval(updatePing, 8000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      connection?.removeEventListener?.("change", updatePing);
      window.clearInterval(pingInterval);
    };
  }, []);

  const connectToNetwork = useCallback(
    async (name: string, avatarUrl?: string, uniqueId?: string) => {
      const safeName = name.trim();
      if (!safeName) return null;

      let currentUserId = authUserId;
      if (!currentUserId) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const sessionExpired = !session?.expires_at || session.expires_at * 1000 <= Date.now();
        if (!session || sessionExpired) {
          setAuthUserId(null);
          return null;
        }

        currentUserId = session.user.id;
        setAuthUserId(currentUserId);
      }

      const syncedDeviceId = getPlatformSyncedDeviceId();
      const normalizedUniqueId = uniqueId?.trim().toLowerCase();
      const nextProfile = {
        display_name: safeName,
        unique_id: normalizedUniqueId || null,
        device_id: syncedDeviceId,
        avatar_url: avatarUrl?.trim() || null,
        user_id: currentUserId,
      };

      const { error } = await supabase.from("profiles").upsert(nextProfile, { onConflict: "user_id" });
      if (error) return null;

      localStorage.setItem(PERMISSIONS_KEY, "false");
      setPermissionsCompleted(false);
      setAppMode("online");

      const mapped = mapProfile(nextProfile, syncedDeviceId);
      setProfile(mapped);
      saveLocalProfileSnapshot(mapped, "online");
      await loadUsers(currentUserId);
      return mapped;
    },
    [authUserId, loadUsers]
  );

  const updateProfile = useCallback(
    async (name: string, avatarUrl?: string, uniqueId?: string) => {
      const safeName = name.trim();
      if (!safeName || !authUserId) return null;

      const syncedDeviceId = getPlatformSyncedDeviceId();
      const normalizedUniqueId = uniqueId?.trim().toLowerCase();
      const nextProfile = {
        display_name: safeName,
        unique_id: normalizedUniqueId || null,
        device_id: syncedDeviceId,
        avatar_url: avatarUrl?.trim() || null,
        user_id: authUserId,
      };

      const { error } = await supabase.from("profiles").upsert(nextProfile, { onConflict: "user_id" });
      if (error) return null;

      const mapped = mapProfile(nextProfile, syncedDeviceId);
      setProfile(mapped);
      saveLocalProfileSnapshot(mapped, appMode);
      await loadUsers(authUserId);
      return mapped;
    },
    [appMode, authUserId, loadUsers]
  );

  const connectOfflineProfile = useCallback((name: string, avatarUrl?: string, uniqueId?: string) => {
    const safeName = name.trim();
    if (!safeName) return null;

    const syncedDeviceId = getPlatformSyncedDeviceId();
    const mapped: SparkMeshProfile = {
      name: safeName,
      uniqueId: uniqueId?.trim().toLowerCase() || undefined,
      deviceId: syncedDeviceId,
      avatarUrl: avatarUrl?.trim() || undefined,
    };

    setAuthUserId(null);
    setProfile(mapped);
    setAppMode("offline");
    localStorage.setItem(PERMISSIONS_KEY, "false");
    setPermissionsCompleted(false);
    saveLocalProfileSnapshot(mapped, "offline");

    return mapped;
  }, []);

  const disconnectFromNetwork = useCallback(() => {
    void supabase.auth.signOut();
    clearLocalProfileSnapshot();
    localStorage.removeItem(PERMISSIONS_KEY);
    setPermissionsCompleted(false);
    setIncomingRequest(null);
    setIncomingCallInvite(null);
    setProfile(null);
    setUsers([]);
    setMessagesByUser({});
    setConversationByUser({});
    setCallHistory([]);
  }, []);

  const completePermissionSetup = useCallback(() => {
    localStorage.setItem(PERMISSIONS_KEY, "true");
    setPermissionsCompleted(true);
  }, []);

  const getMessagesForUser = useCallback(
    (userId: string) => {
      return messagesByUser[userId] ?? [];
    },
    [messagesByUser]
  );

  const ensureConversationIdForUser = useCallback(
    async (peerUserId: string) => {
      let conversationId = conversationByUser[peerUserId];
      if (conversationId) return conversationId;

      const { data } = await supabase.rpc("get_or_create_direct_conversation", { _other_user_id: peerUserId });
      conversationId = data ?? undefined;

      if (conversationId) {
        setConversationByUser((prev) => (prev[peerUserId] === conversationId ? prev : { ...prev, [peerUserId]: conversationId }));
      }

      return conversationId;
    },
    [conversationByUser]
  );

  const getExistingConversationIdForUser = useCallback(
    async (peerUserId: string) => {
      const knownConversationId = conversationByUser[peerUserId];
      if (knownConversationId) return knownConversationId;
      if (!authUserId) return undefined;

      const { data: participantRows } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("user_id", [authUserId, peerUserId]);

      if (!participantRows?.length) return undefined;

      const byConversation = new Map<string, Set<string>>();
      participantRows.forEach((row) => {
        const memberSet = byConversation.get(row.conversation_id) ?? new Set<string>();
        memberSet.add(row.user_id);
        byConversation.set(row.conversation_id, memberSet);
      });

      const matchedConversationId = Array.from(byConversation.entries()).find(
        ([, memberSet]) => memberSet.has(authUserId) && memberSet.has(peerUserId) && memberSet.size === 2
      )?.[0];

      if (!matchedConversationId) return undefined;

      setConversationByUser((prev) =>
        prev[peerUserId] === matchedConversationId ? prev : { ...prev, [peerUserId]: matchedConversationId }
      );

      return matchedConversationId;
    },
    [authUserId, conversationByUser]
  );


  const handleSend = useCallback(
    async (targetUserId: string, payload: { text?: string; attachment?: AttachmentPayload }) => {
      try {
        const hasText = Boolean(payload.text?.trim());
        if (!hasText && !payload.attachment) return;

        if (appMode === "offline" || !authUserId) {
          const optimisticId = `local-${crypto.randomUUID()}`;
          const optimisticAttachment = await normalizeAttachmentForLocalStorage(payload.attachment);

          setMessagesByUser((prev) => ({
            ...prev,
            [targetUserId]: [
              ...(prev[targetUserId] ?? []),
              {
                id: optimisticId,
                chatUserId: targetUserId,
                direction: "sent",
                text: payload.text?.trim() || undefined,
                attachment: optimisticAttachment,
                createdAt: new Date().toISOString(),
                status: "sending",
              },
            ],
          }));

          try {
            const result = await handleSendMessage(targetUserId, payload, { isLowDataModeEnabled });
            const deliveredAttachment = await normalizeAttachmentForLocalStorage(result.payload?.attachment ?? optimisticAttachment);

            setMessagesByUser((prev) => ({
              ...prev,
              [targetUserId]: (prev[targetUserId] ?? []).map((entry) =>
                entry.id === optimisticId
                  ? {
                      ...entry,
                      id: result.messageId || entry.id,
                      attachment: deliveredAttachment,
                      status: "delivered",
                      createdAt: new Date().toISOString(),
                    }
                  : entry
              ),
            }));
          } catch {
            setMessagesByUser((prev) => ({
              ...prev,
              [targetUserId]: (prev[targetUserId] ?? []).map((entry) =>
                entry.id === optimisticId
                  ? {
                      ...entry,
                      status: "failed",
                    }
                  : entry
              ),
            }));
          }
          return;
        }

        const conversationId = await ensureConversationIdForUser(targetUserId);
        if (!conversationId) return;

        let attachmentId: string | null = null;
        let optimizedAttachment = payload.attachment;

        if (payload.attachment?.url) {
          const preparedAttachment = await prepareAttachmentForTransport(payload.attachment, isLowDataModeEnabled);
          const storagePath = `${conversationId}/${authUserId}/${crypto.randomUUID()}-${payload.attachment.name}`;

          await supabase.storage.from("attachments").upload(storagePath, preparedAttachment.blob, {
            contentType: preparedAttachment.mimeType,
            upsert: false,
          });

          const { data: insertedAttachment } = await supabase
            .from("attachments")
            .insert({
              conversation_id: conversationId,
              uploader_id: authUserId,
              file_name: payload.attachment.name,
              file_path: storagePath,
              mime_type: preparedAttachment.mimeType,
              file_size: preparedAttachment.size,
            })
            .select("id")
            .single();

          attachmentId = insertedAttachment?.id ?? null;

          const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(storagePath, 3600);
          optimizedAttachment = {
            ...preparedAttachment.optimizedAttachment,
            url: signed?.signedUrl ?? preparedAttachment.optimizedAttachment.url,
          };
        }

        const { data: insertedMessage, error } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: authUserId,
            content: payload.text?.trim() || null,
            attachment_id: attachmentId,
          })
          .select("id, created_at")
          .single();

        if (error || !insertedMessage) return;

        const persistedAttachment = await normalizeAttachmentForLocalStorage(optimizedAttachment);

        const localMessage: SparkMeshMessage = {
          id: insertedMessage.id,
          chatUserId: targetUserId,
          direction: "sent",
          text: payload.text?.trim() || undefined,
          attachment: persistedAttachment,
          createdAt: insertedMessage.created_at,
          status: "sent",
        };

        setMessagesByUser((prev) => ({
          ...prev,
          [targetUserId]: [...(prev[targetUserId] ?? []), localMessage],
        }));
      } catch (error) {
        handleAppError(error, "Send message");
      }
    },
    [appMode, authUserId, ensureConversationIdForUser, isLowDataModeEnabled]
  );

  const retryOfflineMessage = useCallback(
    async (targetUserId: string, messageId: string) => {
      if (appMode !== "offline") return false;

      const targetMessage = (messagesByUser[targetUserId] ?? []).find((entry) => entry.id === messageId);
      if (!targetMessage || targetMessage.direction !== "sent" || targetMessage.status !== "failed") return false;

      setMessagesByUser((prev) => ({
        ...prev,
        [targetUserId]: (prev[targetUserId] ?? []).map((entry) =>
          entry.id === messageId
            ? {
                ...entry,
                status: "sending",
              }
            : entry
        ),
      }));

      try {
        const result = await handleSendMessage(
          targetUserId,
          {
            text: targetMessage.text,
            attachment: targetMessage.attachment,
          },
          { isLowDataModeEnabled }
        );

        const retriedAttachment = await normalizeAttachmentForLocalStorage(result.payload?.attachment ?? targetMessage.attachment);

        setMessagesByUser((prev) => ({
          ...prev,
          [targetUserId]: (prev[targetUserId] ?? []).map((entry) =>
            entry.id === messageId
              ? {
                  ...entry,
                  attachment: retriedAttachment,
                  status: "delivered",
                  createdAt: new Date().toISOString(),
                }
              : entry
          ),
        }));

        return true;
      } catch {
        setMessagesByUser((prev) => ({
          ...prev,
          [targetUserId]: (prev[targetUserId] ?? []).map((entry) =>
            entry.id === messageId
              ? {
                  ...entry,
                  status: "failed",
                }
              : entry
          ),
        }));

        return false;
      }
    },
    [appMode, isLowDataModeEnabled, messagesByUser]
  );

  const deleteOwnMessage = useCallback(
    async (targetUserId: string, messageId: string) => {
      const targetMessages = messagesByUser[targetUserId] ?? [];
      const targetMessage = targetMessages.find((entry) => entry.id === messageId);
      if (!targetMessage || targetMessage.direction !== "sent") return false;

      if (appMode === "online" && authUserId) {
        const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", authUserId);
        if (error) return false;
      }

      setMessagesByUser((prev) => {
        const nextMessages = (prev[targetUserId] ?? []).filter((entry) => entry.id !== messageId);
        return { ...prev, [targetUserId]: nextMessages };
      });

      return true;
    },
    [appMode, authUserId, messagesByUser]
  );

  const clearConversationMessages = useCallback(
    async (targetUserId: string) => {
      if (appMode === "online" && authUserId) {
        const conversationId = await getExistingConversationIdForUser(targetUserId);

        if (!conversationId) {
          setMessagesByUser((prev) => ({ ...prev, [targetUserId]: [] }));
          return true;
        }

        const { error } = await supabase.rpc("clear_conversation_messages", { _conversation_id: conversationId });
        if (error) return false;

        setMessagesByUser((prev) => ({ ...prev, [targetUserId]: [] }));
        return true;
      }

      setMessagesByUser((prev) => ({ ...prev, [targetUserId]: [] }));
      return true;
    },
    [appMode, authUserId, getExistingConversationIdForUser]
  );

  const removeUserFromMyList = useCallback(
    async (targetUserId: string) => {
      if (appMode === "online" && authUserId) {
        const { error } = await supabase.from("contacts").delete().eq("user_id", authUserId).eq("contact_id", targetUserId);
        if (error) return false;
      }

      setUsers((prev) => {
        const nextUsers = prev.filter((entry) => entry.id !== targetUserId);
        cacheOfflineUsers(nextUsers);
        return nextUsers;
      });

      setMessagesByUser((prev) => {
        if (!(targetUserId in prev)) return prev;
        const next = { ...prev };
        delete next[targetUserId];
        return next;
      });

      setConversationByUser((prev) => {
        if (!(targetUserId in prev)) return prev;
        const next = { ...prev };
        delete next[targetUserId];
        return next;
      });

      return true;
    },
    [appMode, authUserId, cacheOfflineUsers]
  );

  const setMessageReaction = useCallback(
    async (targetUserId: string, messageId: string, emoji: string) => {
      const targetMessages = messagesByUser[targetUserId] ?? [];
      const targetMessage = targetMessages.find((entry) => entry.id === messageId);
      if (!targetMessage) return false;

      if (appMode === "online" && authUserId) {
        const { error } = await supabase.rpc("set_message_reaction", {
          _message_id: messageId,
          _emoji: emoji,
        });
        if (error) return false;
        await loadMessagesForCurrentUser(authUserId);
        return true;
      }

      setMessagesByUser((prev) => ({
        ...prev,
        [targetUserId]: (prev[targetUserId] ?? []).map((entry) =>
          entry.id === messageId
            ? {
                ...entry,
                reactionEmoji: emoji,
              }
            : entry
        ),
      }));

      return true;
    },
    [appMode, authUserId, loadMessagesForCurrentUser, messagesByUser]
  );

  const sendAirTalkRequest = useCallback(
    async (targetUserId: string, requestMessage?: string) => {
      if (!authUserId) return;
      await supabase.from("contact_requests").upsert(
        {
          sender_id: authUserId,
          receiver_id: targetUserId,
          status: "pending",
          request_message: requestMessage?.trim() || null,
        },
        { onConflict: "sender_id,receiver_id" }
      );
    },
    [authUserId]
  );

  const acceptIncomingRequest = useCallback(async () => {
    if (!incomingRequest) return;
    await supabase.rpc("accept_contact_request", { _request_id: incomingRequest.id });
    if (authUserId) {
      await loadUsers(authUserId);
    }
    setIncomingRequest(null);
  }, [authUserId, incomingRequest, loadUsers]);

  const declineIncomingRequest = useCallback(async () => {
    if (!incomingRequest) return;
    await supabase.from("contact_requests").update({ status: "declined" }).eq("id", incomingRequest.id);
    setIncomingRequest(null);
  }, [incomingRequest]);

  const dismissIncomingRequest = useCallback(() => {
    setIncomingRequest(null);
  }, []);

  const createOutgoingCallInvite = useCallback(
    async (targetUserId: string, targetUserUniqueId?: string, callType: "video" | "voice" = "video") => {
      if (!authUserId || !profile?.name) return null;

      const selfUniqueId = profile.uniqueId?.trim() || authUserId;
      const peerUniqueId = targetUserUniqueId?.trim() || targetUserId;
      const callRoomID = buildDeterministicCallRoomId(selfUniqueId, peerUniqueId);
      const startedAt = new Date().toISOString();

      await supabase
        .from("call_invites")
        .update({ status: "cancelled" })
        .eq("sender_id", authUserId)
        .eq("receiver_id", targetUserId)
        .eq("status", "pending");

      const { error } = await supabase.from("call_invites").insert({
        sender_id: authUserId,
        receiver_id: targetUserId,
        call_room_id: callRoomID,
        call_type: callType,
        status: "pending",
      });

      if (error) return null;

      return {
        callRoomID,
        currentUserID: authUserId,
        currentUserName: profile.name,
        peerUserID: targetUserId,
        callType,
        direction: "outgoing" as const,
        startedAt,
      };
    },
    [authUserId, profile?.name, profile?.uniqueId]
  );

  const acceptIncomingCallInvite = useCallback(async () => {
    if (!incomingCallInvite) return null;

    await supabase.from("call_invites").update({ status: "accepted" }).eq("id", incomingCallInvite.id);
    const acceptedInvite = incomingCallInvite;
    setIncomingCallInvite(null);

    return {
      callRoomID: acceptedInvite.callRoomID,
      peerUserID: acceptedInvite.senderId,
      callType: acceptedInvite.callType,
      direction: "incoming" as const,
      startedAt: acceptedInvite.createdAt,
    };
  }, [incomingCallInvite]);

  const declineIncomingCallInvite = useCallback(async () => {
    if (!incomingCallInvite) return;

    await supabase.from("call_invites").update({ status: "declined" }).eq("id", incomingCallInvite.id);
    await addCallHistoryEntry({
      peerUserId: incomingCallInvite.senderId,
      callRoomID: incomingCallInvite.callRoomID,
      callType: incomingCallInvite.callType,
      direction: "incoming",
      status: "declined",
      startedAt: incomingCallInvite.createdAt,
    });

    setIncomingCallInvite(null);
  }, [addCallHistoryEntry, incomingCallInvite]);

  const openScanModal = useCallback(() => setScanOpen(true), []);
  const closeScanModal = useCallback(() => setScanOpen(false), []);

  const startNetworkScan = useCallback(async () => {
    const scanned = await startScan();
    const discoveredUsers = (scanned.peers ?? []).map(mapDiscoveredPeerToUser).filter((entry): entry is SparkMeshUser => entry !== null);

    reconcileWifiDirectUsers(discoveredUsers);

    if (discoveredUsers.length > 0) {
      return discoveredUsers;
    }

    if (authUserId) {
      await loadUsers(authUserId);
    }

    return discoveredUsers;
  }, [authUserId, loadUsers, reconcileWifiDirectUsers]);

  const startCall = useCallback(
    async (userId: string, mode: CallMode) => {
      try {
        setCallSession({ open: true, status: "ringing", mode, userId });
        await initiateCall(userId, mode, { isLowDataModeEnabled });
      } catch (error) {
        handleAppError(error, "Start call");
      }
    },
    [isLowDataModeEnabled]
  );

  const acceptCall = useCallback(() => {
    setCallSession((prev) => ({ ...prev, status: "active" }));
  }, []);

  const setCallStatus = useCallback((status: CallSession["status"]) => {
    setCallSession((prev) => ({ ...prev, status }));
  }, []);

  const endCall = useCallback(async () => {
    await endCallSession();
    setCallSession({ open: false, status: "ringing", mode: "voice", userId: null });
    setMuted(false);
    setSpeakerOn(true);
    setVideoEnabled(true);
  }, []);

  const toggleMute = useCallback(async () => {
    setMuted((prev) => {
      const next = !prev;
      void toggleMuteTrack(next);
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(async () => {
    setSpeakerOn((prev) => {
      const next = !prev;
      void toggleSpeakerOutput(next);
      return next;
    });
  }, []);

  const toggleVideo = useCallback(async () => {
    setVideoEnabled((prev) => {
      const next = !prev;
      void toggleVideoTrack(next);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      authUserId,
      profile,
      isInitializing,
      users,
      appMode,
      setAppMode,
      offlineCachedUsers,
      permissionsCompleted,
      completePermissionSetup,
      currentPing,
      setCurrentPing,
      connectToNetwork,
      refreshUsers,
      connectOfflineProfile,
      updateProfile,
      disconnectFromNetwork,
      getMessagesForUser,
      handleSend,
      retryOfflineMessage,
      deleteOwnMessage,
      clearConversationMessages,
      removeUserFromMyList,
      setMessageReaction,
      incomingRequest,
      incomingCallInvite,
      callHistory,
      sendAirTalkRequest,
      acceptIncomingRequest,
      declineIncomingRequest,
      dismissIncomingRequest,
      createOutgoingCallInvite,
      acceptIncomingCallInvite,
      declineIncomingCallInvite,
      addCallHistoryEntry,
      scanOpen,
      openScanModal,
      closeScanModal,
      startNetworkScan,
      callSession,
      startCall,
      setCallStatus,
      acceptCall,
      endCall,
      isMuted,
      speakerOn,
      videoEnabled,
      toggleMute,
      toggleSpeaker,
      toggleVideo,
    }),
    [
      authUserId,
      profile,
      users,
      appMode,
      offlineCachedUsers,
      permissionsCompleted,
      completePermissionSetup,
      currentPing,
      connectToNetwork,
      refreshUsers,
      connectOfflineProfile,
      updateProfile,
      disconnectFromNetwork,
      getMessagesForUser,
      handleSend,
      retryOfflineMessage,
      deleteOwnMessage,
      clearConversationMessages,
      removeUserFromMyList,
      setMessageReaction,
      incomingRequest,
      incomingCallInvite,
      callHistory,
      sendAirTalkRequest,
      acceptIncomingRequest,
      declineIncomingRequest,
      dismissIncomingRequest,
      createOutgoingCallInvite,
      acceptIncomingCallInvite,
      declineIncomingCallInvite,
      addCallHistoryEntry,
      scanOpen,
      openScanModal,
      closeScanModal,
      startNetworkScan,
      callSession,
      startCall,
      setCallStatus,
      acceptCall,
      endCall,
      isMuted,
      speakerOn,
      videoEnabled,
      toggleMute,
      toggleSpeaker,
      toggleVideo,
    ]
  );
};


