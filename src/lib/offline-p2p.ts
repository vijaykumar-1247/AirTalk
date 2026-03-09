import type { SparkMeshProfile } from "@/types/sparkmesh";

const DEFAULT_SENDER_PROFILE_KEY = "sparkmesh_default_sender_profile";
const ORIGINAL_PEER_IMAGES_KEY = "sparkmesh_peer_original_images";
const ACCEPTED_FRIENDS_KEY = "sparkmesh_offline_accepted_friends";

export const AVATAR_TEMPLATE_COUNT = 15;

export interface DefaultSenderProfile {
  name: string;
  uniqueId: string;
  deviceId: string;
  avatarIndex: number;
  savedAt: string;
}

export interface AcceptedOfflineFriend {
  peerId: string;
  deviceId: string;
  name: string;
  uniqueId?: string;
  avatarIndex: number;
  acceptedAt: string;
  lastSeenAt?: string;
}

const clampAvatarIndex = (value: number) => Math.max(0, Math.min(AVATAR_TEMPLATE_COUNT - 1, value));

const skinPalette = ["hsl(34 60% 78%)", "hsl(30 44% 70%)", "hsl(24 55% 62%)", "hsl(21 45% 54%)", "hsl(17 44% 44%)"];
const hairPalette = ["hsl(24 32% 22%)", "hsl(14 38% 18%)", "hsl(36 52% 30%)", "hsl(4 24% 20%)", "hsl(42 62% 34%)"];
const shirtPalette = ["hsl(202 78% 46%)", "hsl(16 80% 54%)", "hsl(156 62% 36%)", "hsl(280 54% 44%)", "hsl(352 68% 48%)"];
const bgPalette = ["hsl(203 92% 92%)", "hsl(163 78% 90%)", "hsl(35 94% 89%)", "hsl(322 76% 92%)", "hsl(246 70% 92%)"];

const colorAt = (palette: string[], index: number, shift = 0) => palette[(index + shift) % palette.length] ?? palette[0];

const buildAvatarSvg = (index: number) => {
  const skin = colorAt(skinPalette, index);
  const hair = colorAt(hairPalette, index, 1);
  const shirt = colorAt(shirtPalette, index, 2);
  const bg = colorAt(bgPalette, index, 3);
  const eyeY = 76 + (index % 2);
  const mouthY = 96 + (index % 3);
  const hairStyle = index % 3;

  const topHairPath =
    hairStyle === 0
      ? "M34 66c4-24 22-36 46-36s42 12 46 36l-2 10H36l-2-10z"
      : hairStyle === 1
        ? "M30 70c7-27 26-40 50-40s43 13 50 40l-6 8H36l-6-8z"
        : "M36 64c6-21 23-34 44-34s38 13 44 34l-4 12H40l-4-12z";

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'>
    <rect width='180' height='180' rx='90' fill='${bg}'/>
    <circle cx='90' cy='90' r='84' fill='white' opacity='0.24'/>
    <ellipse cx='90' cy='150' rx='56' ry='34' fill='${shirt}'/>
    <rect x='76' y='110' width='28' height='24' rx='12' fill='${skin}'/>
    <ellipse cx='90' cy='84' rx='38' ry='42' fill='${skin}'/>
    <path d='${topHairPath}' fill='${hair}'/>
    <ellipse cx='74' cy='${eyeY}' rx='4' ry='3.5' fill='hsl(220 18% 20%)'/>
    <ellipse cx='106' cy='${eyeY}' rx='4' ry='3.5' fill='hsl(220 18% 20%)'/>
    <path d='M76 ${mouthY}c4 5 9 8 14 8s10-3 14-8' stroke='hsl(12 42% 36%)' stroke-width='3' stroke-linecap='round' fill='none'/>
    <circle cx='58' cy='92' r='4' fill='${skin}'/>
    <circle cx='122' cy='92' r='4' fill='${skin}'/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const avatarTemplates = Array.from({ length: AVATAR_TEMPLATE_COUNT }, (_, index) => ({
  index,
  id: `AVATAR_${String(index + 1).padStart(2, "0")}`,
  label: `Avatar ${String(index + 1).padStart(2, "0")}`,
  dataUrl: buildAvatarSvg(index),
}));

const safeStorageRead = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const safeStorageWrite = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getAvatarTemplateByIndex = (avatarIndex: number) => avatarTemplates[clampAvatarIndex(avatarIndex)] ?? avatarTemplates[0];

export const getAvatarTemplateBySeed = (seed: string) => {
  if (!seed.trim()) return avatarTemplates[0];
  const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return getAvatarTemplateByIndex(hash % AVATAR_TEMPLATE_COUNT);
};

export const saveDefaultSenderProfile = (profile: Omit<DefaultSenderProfile, "savedAt">) => {
  const normalized: DefaultSenderProfile = {
    ...profile,
    uniqueId: profile.uniqueId.trim(),
    avatarIndex: clampAvatarIndex(profile.avatarIndex),
    savedAt: new Date().toISOString(),
  };
  safeStorageWrite(DEFAULT_SENDER_PROFILE_KEY, normalized);
  return normalized;
};

export const loadDefaultSenderProfile = () => {
  const stored = safeStorageRead<DefaultSenderProfile | null>(DEFAULT_SENDER_PROFILE_KEY, null);
  if (!stored) return null;
  if (!stored.name || !stored.deviceId) return null;
  return {
    ...stored,
    avatarIndex: clampAvatarIndex(stored.avatarIndex),
  };
};

export const profileToDefaultSender = (profile: SparkMeshProfile | null, fallbackAvatarIndex = 0): DefaultSenderProfile | null => {
  if (!profile?.name || !profile.deviceId) return null;
  return {
    name: profile.name,
    uniqueId: profile.uniqueId ?? "",
    deviceId: profile.deviceId,
    avatarIndex: clampAvatarIndex(fallbackAvatarIndex),
    savedAt: new Date().toISOString(),
  };
};

const normalizeChunk = (value: string) => value.replace(/[#\n\r]/g, " ").trim();

export const buildBroadcastIdentifier = (profile: Pick<DefaultSenderProfile, "name" | "uniqueId" | "avatarIndex">) => {
  const avatarId = `AVATAR_${String(clampAvatarIndex(profile.avatarIndex) + 1).padStart(2, "0")}`;
  return `AIRTALK#${normalizeChunk(profile.name)}#${normalizeChunk(profile.uniqueId || "UNKNOWN")}#${avatarId}`;
};

export const parseBroadcastIdentifier = (payload: string) => {
  if (!payload.startsWith("AIRTALK#")) return null;
  const parts = payload.split("#");
  if (parts.length < 4) return null;

  const avatarTag = parts[3] ?? "AVATAR_01";
  const parsedAvatar = Number(avatarTag.replace(/[^0-9]/g, ""));
  const avatarIndex = Number.isFinite(parsedAvatar) && parsedAvatar > 0 ? clampAvatarIndex(parsedAvatar - 1) : 0;

  return {
    name: parts[1]?.trim() || "Nearby User",
    uniqueId: parts[2]?.trim() || "UNKNOWN",
    avatarIndex,
  };
};

export const saveOriginalPeerImage = (deviceId: string, imageDataUrl: string) => {
  if (!deviceId || !imageDataUrl) return;
  const store = safeStorageRead<Record<string, string>>(ORIGINAL_PEER_IMAGES_KEY, {});
  store[deviceId] = imageDataUrl;
  safeStorageWrite(ORIGINAL_PEER_IMAGES_KEY, store);
};

export const getOriginalPeerImage = (deviceId: string) => {
  if (!deviceId) return undefined;
  const store = safeStorageRead<Record<string, string>>(ORIGINAL_PEER_IMAGES_KEY, {});
  return store[deviceId];
};

export const saveAcceptedFriend = (friend: AcceptedOfflineFriend) => {
  const store = safeStorageRead<Record<string, AcceptedOfflineFriend>>(ACCEPTED_FRIENDS_KEY, {});
  store[friend.deviceId] = friend;
  safeStorageWrite(ACCEPTED_FRIENDS_KEY, store);
};

export const getAcceptedFriends = () => {
  const store = safeStorageRead<Record<string, AcceptedOfflineFriend>>(ACCEPTED_FRIENDS_KEY, {});
  return Object.values(store);
};
