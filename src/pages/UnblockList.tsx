import { ArrowLeft, Ban, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSparkMesh } from "@/context/SparkMeshContext";
import { buildChatListPreferenceScope, loadChatListPreferences, saveChatListPreferences } from "@/lib/chat-list-preferences";
import { useAppLanguage } from "@/lib/i18n";
import { getAvatarTemplateBySeed } from "@/lib/offline-p2p";

const UnblockList = () => {
  const navigate = useNavigate();
  const { t } = useAppLanguage();
  const { users, offlineCachedUsers, authUserId, profile } = useSparkMesh();
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  const preferenceScopeKey = useMemo(
    () => buildChatListPreferenceScope(authUserId, profile?.deviceId),
    [authUserId, profile?.deviceId],
  );

  useEffect(() => {
    const preferences = loadChatListPreferences(preferenceScopeKey);
    setBlockedUserIds(preferences.blockedUserIds);
  }, [preferenceScopeKey]);

  useEffect(() => {
    const current = loadChatListPreferences(preferenceScopeKey);
    saveChatListPreferences(preferenceScopeKey, {
      ...current,
      blockedUserIds,
    });
  }, [blockedUserIds, preferenceScopeKey]);

  const knownUsersById = useMemo(() => {
    const merged = [...users, ...offlineCachedUsers];
    return merged.reduce<Record<string, (typeof merged)[number]>>((acc, entry) => {
      acc[entry.id] = entry;
      return acc;
    }, {});
  }, [offlineCachedUsers, users]);

  const handleUnblock = (userId: string) => {
    setBlockedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  return (
    <main className="app-wallpaper-bg mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground shadow-card">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{t("settings.unblockListTitle")}</h1>
          <p className="truncate text-xs text-primary-foreground/80">{t("settings.unblockListSubtitle")}</p>
        </div>
        <Button className="gap-1" onClick={() => navigate("/settings")} size="sm" variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </header>

      <section className="flex-1 space-y-3 overflow-y-auto p-4 pb-24">
        {blockedUserIds.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center shadow-card">
            <Ban className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium text-card-foreground">{t("settings.unblockListEmpty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("settings.unblockListEmptyHint")}</p>
          </div>
        ) : (
          blockedUserIds.map((blockedId) => {
            const knownUser = knownUsersById[blockedId];
            const userName = knownUser?.name ?? t("settings.unknownUser");
            const avatar = knownUser?.avatarUrl ?? getAvatarTemplateBySeed(knownUser?.uniqueId ?? blockedId).dataUrl;

            return (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card" key={blockedId}>
                <img alt={`${userName} avatar`} className="h-11 w-11 rounded-full border border-border object-cover" src={avatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-card-foreground">{userName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">ID: {blockedId}</p>
                </div>
                <Button className="gap-1" onClick={() => handleUnblock(blockedId)} size="sm" type="button" variant="outline">
                  <UserCheck className="h-4 w-4" />
                  {t("settings.unblock")}
                </Button>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
};

export default UnblockList;
