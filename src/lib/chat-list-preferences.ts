export interface ChatListPreferences {
  archivedUserIds: string[];
  blockedUserIds: string[];
  pinnedUserIds: string[];
}

const STORAGE_PREFIX = "sparkmesh_chat_list_preferences";

const normalizeUserIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)));
};

const getStorageKey = (scopeKey: string) => `${STORAGE_PREFIX}_${scopeKey}`;

export const buildChatListPreferenceScope = (ownerId?: string | null, fallbackDeviceId?: string) => ownerId ?? fallbackDeviceId ?? "guest";

const emptyPreferences = (): ChatListPreferences => ({
  archivedUserIds: [],
  blockedUserIds: [],
  pinnedUserIds: [],
});

export const loadChatListPreferences = (scopeKey: string): ChatListPreferences => {
  try {
    const raw = localStorage.getItem(getStorageKey(scopeKey));
    if (!raw) return emptyPreferences();
    const parsed = JSON.parse(raw) as Partial<ChatListPreferences>;
    return {
      archivedUserIds: normalizeUserIds(parsed.archivedUserIds),
      blockedUserIds: normalizeUserIds(parsed.blockedUserIds),
      pinnedUserIds: normalizeUserIds(parsed.pinnedUserIds),
    };
  } catch {
    return emptyPreferences();
  }
};

export const saveChatListPreferences = (scopeKey: string, preferences: ChatListPreferences) => {
  localStorage.setItem(getStorageKey(scopeKey), JSON.stringify(preferences));
};
