import { Capacitor } from "@capacitor/core";
import { WifiDirectTransport } from "@/plugins/wifi-direct-transport";
import { getCallQualityProfile, prepareAttachmentForTransport } from "@/lib/low-data-mode";
import type { AttachmentPayload, CallMode } from "@/types/sparkmesh";

const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

const toBase64 = async (blob: Blob) =>
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read binary payload"));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unknown file reader error"));
    reader.readAsDataURL(blob);
  });

const runNative = async <T>(label: string, operation: () => Promise<T>, fallback: T) => {
  if (!isNativeAndroid()) return fallback;

  try {
    return await operation();
  } catch (error) {
    console.warn(`[WifiDirectTransport] ${label} failed`, error);
    return fallback;
  }
};

export const handleSendMessage = async (
  targetUserId: string,
  payload: { text?: string; attachment?: AttachmentPayload },
  options?: { isLowDataModeEnabled?: boolean }
) => {
  const attachment = payload.attachment;
  let attachmentBase64: string | undefined;
  let optimizedAttachment = attachment;

  if (attachment?.url) {
    try {
      const preparedAttachment = await prepareAttachmentForTransport(attachment, Boolean(options?.isLowDataModeEnabled));
      optimizedAttachment = preparedAttachment.optimizedAttachment;
      attachmentBase64 = await toBase64(preparedAttachment.blob);
    } catch {
      attachmentBase64 = undefined;
    }
  }

  return await runNative(
    "sendMessage",
    async () => {
      const result = await WifiDirectTransport.sendMessage({
        peerId: targetUserId,
        text: payload.text,
        attachmentBase64,
        attachmentName: optimizedAttachment?.name,
        mimeType: optimizedAttachment?.type,
      });
      return { ...result, targetUserId, payload: { ...payload, attachment: optimizedAttachment } };
    },
    { ok: true, messageId: `local-${crypto.randomUUID()}`, targetUserId, payload: { ...payload, attachment: optimizedAttachment } }
  );
};

export const sendOfflineConnectionRequest = async (
  peerId: string,
  payload: { fromName: string; fromUniqueId: string; fromDeviceId: string; avatarIndex: number; message?: string }
) => {
  return await runNative(
    "sendOfflineConnectionRequest",
    async () => {
      await WifiDirectTransport.connectToPeer({ peerId });
      const packet = JSON.stringify({ type: "AIRTALK_REQUEST", ...payload, createdAt: new Date().toISOString() });
      return await WifiDirectTransport.sendMessage({ peerId, text: packet });
    },
    { ok: true, messageId: `local-${crypto.randomUUID()}` }
  );
};

export const sendOriginalProfileImage = async (peerId: string, deviceId: string, imageUrl?: string) => {
  if (!imageUrl) return { ok: false, messageId: "missing-image" };

  let attachmentBase64 = "";
  let mimeType = "image/jpeg";

  try {
    const blob = await fetch(imageUrl).then((response) => response.blob());
    attachmentBase64 = await toBase64(blob);
    mimeType = blob.type || mimeType;
  } catch {
    return { ok: false, messageId: "image-conversion-failed" };
  }

  return await runNative(
    "sendOriginalProfileImage",
    async () =>
      await WifiDirectTransport.sendMessage({
        peerId,
        text: `AIRTALK_ORIGINAL_IMAGE#${deviceId}`,
        attachmentBase64,
        attachmentName: `profile-${deviceId}.jpg`,
        mimeType,
      }),
    { ok: true, messageId: `local-${crypto.randomUUID()}` }
  );
};

export const startOfflineBroadcast = async (payload: string) => {
  return await runNative(
    "startOfflineBroadcast",
    async () => await WifiDirectTransport.startAdvertising({ payload }),
    { ok: true, payload }
  );
};

export const stopOfflineBroadcast = async () => {
  return await runNative(
    "stopOfflineBroadcast",
    async () => await WifiDirectTransport.stopAdvertising(),
    { ok: true }
  );
};

export const autoReconnectKnownPeers = async (peerIds: string[]) => {
  const uniquePeerIds = Array.from(new Set(peerIds.filter(Boolean)));
  if (uniquePeerIds.length === 0) return { ok: true, connectedPeerIds: [] as string[] };

  return await runNative(
    "autoReconnectKnownPeers",
    async () => await WifiDirectTransport.connectKnownPeers({ peerIds: uniquePeerIds }),
    { ok: true, connectedPeerIds: uniquePeerIds }
  );
};

export const startScan = async () => {
  return await runNative(
    "startScan",
    async () => {
      await WifiDirectTransport.startDiscovery();
      const discovered = await WifiDirectTransport.getDiscoveredPeers();
      return { ok: true, peers: discovered.peers };
    },
    { ok: true, peers: [] as unknown[] }
  );
};

export const initiateCall = async (userId: string, mode: CallMode, options?: { isLowDataModeEnabled?: boolean }) => {
  const { offlineCallProfile } = getCallQualityProfile(Boolean(options?.isLowDataModeEnabled));

  return await runNative(
    "initiateCall",
    async () => {
      await WifiDirectTransport.connectToPeer({ peerId: userId });
      const result = await WifiDirectTransport.initiateCall({ peerId: userId, mode });
      return { ...result, userId, mode, qualityProfile: offlineCallProfile };
    },
    { ok: true, peerId: userId, userId, mode, qualityProfile: offlineCallProfile }
  );
};

export const endCallSession = async () => {
  return await runNative(
    "endCallSession",
    async () => {
      await WifiDirectTransport.endCall();
      await WifiDirectTransport.disconnectPeer();
      return { ok: true };
    },
    { ok: true }
  );
};

export const toggleMuteTrack = async (muted: boolean) => {
  return await runNative(
    "toggleMuteTrack",
    async () => {
      const result = await WifiDirectTransport.setMute({ muted });
      return { ...result, muted: result.muted };
    },
    { ok: true, muted }
  );
};

export const toggleSpeakerOutput = async (speakerOn: boolean) => {
  return await runNative(
    "toggleSpeakerOutput",
    async () => {
      const result = await WifiDirectTransport.setSpeaker({ speakerOn });
      return { ...result, speakerOn: result.speakerOn };
    },
    { ok: true, speakerOn }
  );
};

export const toggleVideoTrack = async (videoEnabled: boolean) => {
  return await runNative(
    "toggleVideoTrack",
    async () => {
      const result = await WifiDirectTransport.setVideo({ videoEnabled });
      return { ...result, videoEnabled: result.videoEnabled };
    },
    { ok: true, videoEnabled }
  );
};
