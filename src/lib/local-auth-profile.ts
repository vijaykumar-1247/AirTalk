import type { SparkMeshProfile } from "@/types/sparkmesh";

const LOCAL_AUTH_PROFILE_KEY = "sparkmesh_local_auth_profile";
const LOCAL_ONLINE_CREDENTIALS_KEY = "sparkmesh_online_credentials";
const SESSION_ONLINE_CREDENTIALS_KEY = "sparkmesh_online_credentials_session";

export type LocalAuthMode = "online" | "offline";

export type StoredLocalProfile = SparkMeshProfile & {
  mode: LocalAuthMode;
  savedAt: string;
};

export type StoredOnlineCredentials = {
  uniqueId: string;
  password: string;
  savedAt: string;
};

const normalizeUniqueId = (value: string) => value.trim().toLowerCase();

export const saveLocalProfileSnapshot = (profile: SparkMeshProfile, mode: LocalAuthMode) => {
  const next: StoredLocalProfile = {
    ...profile,
    mode,
    savedAt: new Date().toISOString(),
  };

  localStorage.setItem(LOCAL_AUTH_PROFILE_KEY, JSON.stringify(next));
  return next;
};

export const loadLocalProfileSnapshot = (): StoredLocalProfile | null => {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_PROFILE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredLocalProfile>;
    if (!parsed?.name || !parsed?.deviceId) return null;

    return {
      name: parsed.name,
      uniqueId: parsed.uniqueId,
      deviceId: parsed.deviceId,
      avatarUrl: parsed.avatarUrl,
      mode: parsed.mode === "online" ? "online" : "offline",
      savedAt: parsed.savedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const clearLocalProfileSnapshot = () => {
  localStorage.removeItem(LOCAL_AUTH_PROFILE_KEY);
};

export const cacheOnlineCredentialsForLogout = (uniqueId: string, password: string) => {
  const safeUniqueId = normalizeUniqueId(uniqueId);
  const safePassword = password.trim();
  if (!safeUniqueId || !safePassword) return null;

  const draft: StoredOnlineCredentials = {
    uniqueId: safeUniqueId,
    password: safePassword,
    savedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(SESSION_ONLINE_CREDENTIALS_KEY, JSON.stringify(draft));
  return draft;
};

export const saveOnlineCredentialsForAutoFill = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_ONLINE_CREDENTIALS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredOnlineCredentials>;
    const safeUniqueId = normalizeUniqueId(parsed?.uniqueId ?? "");
    const safePassword = parsed?.password?.trim() ?? "";
    if (!safeUniqueId || !safePassword) return null;

    const payload: StoredOnlineCredentials = {
      uniqueId: safeUniqueId,
      password: safePassword,
      savedAt: parsed?.savedAt ?? new Date().toISOString(),
    };

    localStorage.setItem(LOCAL_ONLINE_CREDENTIALS_KEY, JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
};

export const loadSavedOnlineCredentials = (): StoredOnlineCredentials | null => {
  try {
    const raw = localStorage.getItem(LOCAL_ONLINE_CREDENTIALS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredOnlineCredentials>;
    const safeUniqueId = normalizeUniqueId(parsed?.uniqueId ?? "");
    const safePassword = parsed?.password?.trim() ?? "";
    if (!safeUniqueId || !safePassword) return null;

    return {
      uniqueId: safeUniqueId,
      password: safePassword,
      savedAt: parsed?.savedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const clearSavedOnlineCredentials = () => {
  localStorage.removeItem(LOCAL_ONLINE_CREDENTIALS_KEY);
};
