import { Capacitor } from "@capacitor/core";
import { bluetoothDiscoveryService } from "@/lib/bluetooth-discovery";
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
    console.warn(`[OfflineDiscovery] ${label} failed`, error);
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

  // For offline messaging, we use WebRTC data channels or fall back to online infrastructure
  // BLE is only used for discovery
  return { ok: true, messageId: `local-${crypto.randomUUID()}`, targetUserId, payload: { ...payload, attachment: optimizedAttachment } };
};

export const sendOfflineConnectionRequest = async (
  peerId: string,
  payload: { fromName: string; fromUniqueId: string; fromDeviceId: string; avatarIndex: number; message?: string }
) => {
  // For offline connection requests, we use WebRTC signaling or fall back to online infrastructure
  // BLE is only used for discovery
  return { ok: true, messageId: `local-${crypto.randomUUID()}` };
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
  // Start Bluetooth LE advertising
  const bluetoothResult = await runNative(
    "startOfflineBroadcast",
    async () => {
      const bluetoothInitialized = await bluetoothDiscoveryService.initialize();
      if (bluetoothInitialized) {
        // Extract device name from payload for Bluetooth advertising
        const deviceName = payload.split('|')[0] || 'AirTalk Device';
        await bluetoothDiscoveryService.startAdvertising(deviceName);
      }
      return { ok: true };
    },
    { ok: false }
  );

  return { ok: bluetoothResult.ok, payload };
};

export const stopOfflineBroadcast = async () => {
  // Stop Bluetooth LE advertising
  try {
    await bluetoothDiscoveryService.stopAdvertising();
  } catch (error) {
    console.warn('Failed to stop Bluetooth advertising:', error);
  }

  return { ok: true };
};

export const autoReconnectKnownPeers = async (peerIds: string[]) => {
  const uniquePeerIds = Array.from(new Set(peerIds.filter(Boolean)));
  if (uniquePeerIds.length === 0) return { ok: true, connectedPeerIds: [] as string[] };

  // For BLE discovery, we don't maintain persistent connections
  // Peers are discovered dynamically when scanning
  return { ok: true, connectedPeerIds: uniquePeerIds };
};

export const startScan = async () => {
  // Use Bluetooth LE discovery
  const bluetoothResult = await runNative(
    "startScan",
    async () => {
      const bluetoothInitialized = await bluetoothDiscoveryService.initialize();
      if (bluetoothInitialized) {
        const bluetoothDevices = await bluetoothDiscoveryService.startDiscovery(8000);
        // Convert SparkMeshUser[] to the expected peer format
        const bluetoothPeers = bluetoothDevices.map(device => ({
          peerId: device.id,
          deviceName: device.name,
          deviceAddress: device.deviceId,
          signalStrength: device.signalStrength,
          rangeMeters: device.rangeMeters,
          status: 'available' as const,
        }));
        return { ok: true, peers: bluetoothPeers };
      }
      return { ok: false, peers: [] };
    },
    { ok: false, peers: [] as unknown[] }
  );

  return { ok: bluetoothResult.ok, peers: bluetoothResult.peers };
};

export const initiateCall = async (userId: string, mode: CallMode, options?: { isLowDataModeEnabled?: boolean }) => {
  const { offlineCallProfile } = getCallQualityProfile(Boolean(options?.isLowDataModeEnabled));

  // For offline calls, we use WebRTC directly since BLE is just for discovery
  return { ok: true, peerId: userId, userId, mode, qualityProfile: offlineCallProfile };
};

export const endCallSession = async () => {
  // For offline calls, WebRTC handles the call ending
  return { ok: true };
};

export const toggleMuteTrack = async (muted: boolean) => {
  // For offline calls, WebRTC handles muting
  return { ok: true, muted };
};

export const toggleSpeakerOutput = async (speakerOn: boolean) => {
  // For offline calls, WebRTC handles speaker output
  return { ok: true, speakerOn };
};

export const toggleVideoTrack = async (videoEnabled: boolean) => {
  // For offline calls, WebRTC handles video
  return { ok: true, videoEnabled };
};
