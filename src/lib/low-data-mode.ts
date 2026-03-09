import type { AttachmentPayload } from "@/types/sparkmesh";

const waitForImageBitmap = async (blob: Blob): Promise<ImageBitmap | null> => {
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") return null;

  try {
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
};

const compressImageBlob = async (blob: Blob, quality = 0.55, maxWidth = 1280): Promise<Blob> => {
  if (typeof window === "undefined") return blob;

  const bitmap = await waitForImageBitmap(blob);
  if (!bitmap) return blob;

  const width = bitmap.width;
  const height = bitmap.height;
  const scale = width > maxWidth ? maxWidth / width : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const compressed = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/jpeg", quality);
  });

  bitmap.close();
  return compressed ?? blob;
};

export const prepareAttachmentForTransport = async (
  attachment: AttachmentPayload,
  isLowDataModeEnabled: boolean
): Promise<{ blob: Blob; mimeType: string; size: number; optimizedAttachment: AttachmentPayload }> => {
  const sourceBlob = await fetch(attachment.url).then((response) => response.blob());

  if (!isLowDataModeEnabled) {
    return {
      blob: sourceBlob,
      mimeType: sourceBlob.type || attachment.type,
      size: sourceBlob.size,
      optimizedAttachment: attachment,
    };
  }

  // TODO(native): Replace this web-based compression with a React Native native module compressor
  // (e.g. react-native-image-resizer/react-native-compressor) for production mobile builds.
  if (!sourceBlob.type.startsWith("image/")) {
    return {
      blob: sourceBlob,
      mimeType: sourceBlob.type || attachment.type,
      size: sourceBlob.size,
      optimizedAttachment: {
        ...attachment,
        size: sourceBlob.size,
      },
    };
  }

  const compressedBlob = await compressImageBlob(sourceBlob);

  return {
    blob: compressedBlob,
    mimeType: compressedBlob.type || "image/jpeg",
    size: compressedBlob.size,
    optimizedAttachment: {
      ...attachment,
      type: compressedBlob.type || "image/jpeg",
      size: compressedBlob.size,
    },
  };
};

export const getCallQualityProfile = (isLowDataModeEnabled: boolean) => {
  if (!isLowDataModeEnabled) {
    return {
      zegoJoinRoomOverrides: {} as Record<string, unknown>,
      offlineCallProfile: "standard" as const,
    };
  }

  // TODO(native): Apply this profile to WebRTC/native call engines when integrating RN native call stack.
  return {
    zegoJoinRoomOverrides: {
      videoResolutionDefault: "360p",
    } as Record<string, unknown>,
    offlineCallProfile: "low" as const,
  };
};
