import { Archive, Globe2, History, House, Phone, Pin, Radar, Settings, ShieldAlert, ShieldCheck, SignalHigh, Wifi, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserHoldOptionsDialog from "@/components/sparkmesh/UserHoldOptionsDialog";
import { Button } from "@/components/ui/button";

import { useSparkMesh } from "@/context/SparkMeshContext";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { supabase } from "@/integrations/supabase/client";
import { useAppLanguage } from "@/lib/i18n";
import { formatTime12 } from "@/lib/time-format";
import { buildChatListPreferenceScope, loadChatListPreferences, saveChatListPreferences } from "@/lib/chat-list-preferences";
import { getAvatarTemplateBySeed } from "@/lib/offline-p2p";
import { getMissingPermissions, loadPermissionStatuses, type PermissionStatusMap } from "@/lib/permission-status";
import type { IncomingAirTalkRequest, SparkMeshUser } from "@/types/sparkmesh";

const PERMISSION_POPUP_DISMISSED_KEY = "sparkmesh_permission_popup_dismissed";

const getSignalQuality = (ping: number) => {
  if (ping <= 90) return "excellent";
  if (ping <= 190) return "stable";
  return "weak";
};

const getRangeLabel = (ping: number) => {
  if (ping <= 90) return "Near";
  if (ping <= 190) return "Mid";
  return "Far";
};

const formatCallDuration = (durationSeconds?: number) => {
  if (!durationSeconds || durationSeconds <= 0) return "0m 00s";
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
};

const HomePage = () => {
  const navigate = useNavigate();
  const {
    users,
    profile,
    authUserId,
    getMessagesForUser,
    currentPing,
    appMode,
    setAppMode,
    offlineCachedUsers,
    callHistory,
    createOutgoingCallInvite,
    refreshUsers,
    removeUserFromMyList,
  } = useSparkMesh();
  const { t } = useAppLanguage();
  const [permissionStatuses, setPermissionStatuses] = useState<PermissionStatusMap>(() => loadPermissionStatuses());
  const [showPermissionStatus, setShowPermissionStatus] = useState(() => localStorage.getItem(PERMISSION_POPUP_DISMISSED_KEY) !== "true");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showRecentCalls, setShowRecentCalls] = useState(false);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [isAppOnline, setIsAppOnline] = useState(() => navigator.onLine);
  const [pendingRequests, setPendingRequests] = useState<IncomingAirTalkRequest[]>([]);
  const [archivedUserIds, setArchivedUserIds] = useState<string[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [pinnedUserIds, setPinnedUserIds] = useState<string[]>([]);
  const [actionUser, setActionUser] = useState<SparkMeshUser | null>(null);
  const seenReceivedCountRef = useRef<Record<string, number>>({});
  const holdTimerRef = useRef<number | null>(null);
  const suppressTapRef = useRef(false);
  const listScrollRef = useRef<HTMLElement | null>(null);

  const { bindPullToRefresh, isRefreshing, pullDistance, readyToRefresh } = usePullToRefresh({
    getScrollTop: () => listScrollRef.current?.scrollTop ?? 0,
    onRefresh: () => {
      window.location.reload();
    },
  });

  const fetchPendingRequests = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentUserId = session?.user.id;
    if (!currentUserId) {
      setPendingRequests([]);
      return;
    }

    const { data: requests } = await supabase
      .from("contact_requests")
      .select("id, sender_id, created_at, request_message")
      .eq("receiver_id", currentUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!requests || requests.length === 0) {
      setPendingRequests([]);
      return;
    }

    const senderIds = requests.map((request) => request.sender_id);

    const { data: senders } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", senderIds);

    const senderMap = new Map((senders ?? []).map((sender) => [sender.user_id, { name: sender.display_name, avatar: sender.avatar_url }]));

    setPendingRequests(
      requests.map((request) => ({
        id: request.id,
        senderId: request.sender_id,
        senderName: senderMap.get(request.sender_id)?.name ?? "Unknown user",
        senderAvatarUrl: senderMap.get(request.sender_id)?.avatar ?? undefined,
        requestMessage: request.request_message ?? undefined,
        createdAt: request.created_at,
      }))
    );
  }, []);

  useEffect(() => {
    const refresh = () => setPermissionStatuses(loadPermissionStatuses());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupNotifications = async () => {
      await fetchPendingRequests();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUserId = session?.user.id;
      if (!currentUserId) return;

      notificationChannel = supabase
        .channel(`home-notifications-${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contact_requests", filter: `receiver_id=eq.${currentUserId}` },
          async () => {
            await fetchPendingRequests();
          }
        )
        .subscribe();
    };

    void setupNotifications();

    return () => {
      if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
  }, [fetchPendingRequests]);

  useEffect(() => {
    const onOnline = () => setIsAppOnline(true);
    const onOffline = () => setIsAppOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!holdTimerRef.current) return;
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    };
  }, []);

  const baseVisibleUsers = useMemo(() => {
    if (appMode === "online") {
      return users.filter((entry) => entry.source === "online");
    }

    return offlineCachedUsers;
  }, [appMode, offlineCachedUsers, users]);

  const preferenceScopeKey = useMemo(() => buildChatListPreferenceScope(authUserId, profile?.deviceId), [authUserId, profile?.deviceId]);

  useEffect(() => {
    const preferences = loadChatListPreferences(preferenceScopeKey);
    setArchivedUserIds(preferences.archivedUserIds);
    setBlockedUserIds(preferences.blockedUserIds);
    setPinnedUserIds(preferences.pinnedUserIds);
  }, [preferenceScopeKey]);

  useEffect(() => {
    saveChatListPreferences(preferenceScopeKey, { archivedUserIds, blockedUserIds, pinnedUserIds });
  }, [archivedUserIds, blockedUserIds, pinnedUserIds, preferenceScopeKey]);

  const archivedUserSet = useMemo(() => new Set(archivedUserIds), [archivedUserIds]);
  const blockedUserSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);
  const pinnedUserSet = useMemo(() => new Set(pinnedUserIds), [pinnedUserIds]);

  const sortUsersByPin = useCallback(
    (entries: SparkMeshUser[]) =>
      [...entries].sort((left, right) => {
        const leftPinned = pinnedUserSet.has(left.id);
        const rightPinned = pinnedUserSet.has(right.id);
        if (leftPinned === rightPinned) return left.name.localeCompare(right.name);
        return leftPinned ? -1 : 1;
      }),
    [pinnedUserSet]
  );

  const visibleUsers = useMemo(
    () =>
      sortUsersByPin(baseVisibleUsers.filter((entry) => !blockedUserSet.has(entry.id) && !archivedUserSet.has(entry.id))),
    [archivedUserSet, baseVisibleUsers, blockedUserSet, sortUsersByPin]
  );

  const archivedUsers = useMemo(
    () =>
      sortUsersByPin(baseVisibleUsers.filter((entry) => !blockedUserSet.has(entry.id) && archivedUserSet.has(entry.id))),
    [archivedUserSet, baseVisibleUsers, blockedUserSet, sortUsersByPin]
  );

  const missingPermissions = useMemo(() => getMissingPermissions(permissionStatuses), [permissionStatuses]);

  useEffect(() => {
    const hasMissingPermissions = missingPermissions.length > 0;

    if (hasMissingPermissions) {
      localStorage.removeItem(PERMISSION_POPUP_DISMISSED_KEY);
      setShowPermissionStatus(true);
      return;
    }

    localStorage.setItem(PERMISSION_POPUP_DISMISSED_KEY, "true");
    setShowPermissionStatus(false);
  }, [missingPermissions]);

  useEffect(() => {
    setUnreadCounts((prev) => {
      const next = { ...prev };

      for (const user of visibleUsers) {
        const receivedCount = getMessagesForUser(user.id).filter((message) => message.direction === "received").length;
        const previousSeen = seenReceivedCountRef.current[user.id];

        if (previousSeen === undefined) {
          seenReceivedCountRef.current[user.id] = receivedCount;
          continue;
        }

        if (receivedCount > previousSeen) {
          next[user.id] = (next[user.id] ?? 0) + (receivedCount - previousSeen);
        }

        seenReceivedCountRef.current[user.id] = receivedCount;
      }

      return next;
    });
  }, [visibleUsers, getMessagesForUser]);

  const openChat = (userId: string) => {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }

    const receivedCount = getMessagesForUser(userId).filter((message) => message.direction === "received").length;
    seenReceivedCountRef.current[userId] = receivedCount;
    setUnreadCounts((prev) => ({ ...prev, [userId]: 0 }));
    navigate(`/chat/${userId}`);
  };

  const clearHoldTimer = () => {
    if (!holdTimerRef.current) return;
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  const openActionSheet = (user: SparkMeshUser) => {
    clearHoldTimer();
    setActionUser(user);
  };

  const beginHoldUser = (user: SparkMeshUser) => {
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      suppressTapRef.current = true;
      setActionUser(user);
    }, 450);
  };

  const toggleArchiveUser = () => {
    if (!actionUser) return;
    const userId = actionUser.id;
    setArchivedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
    setActionUser(null);
  };

  const toggleBlockUser = () => {
    if (!actionUser) return;
    const userId = actionUser.id;
    setBlockedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
    setActionUser(null);
  };

  const togglePinUser = () => {
    if (!actionUser) return;
    const userId = actionUser.id;
    setPinnedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
    setActionUser(null);
  };

  const handleDeleteUser = async () => {
    if (!actionUser) return;
    const userId = actionUser.id;
    const removed = await removeUserFromMyList(userId);
    if (removed) {
      setArchivedUserIds((prev) => prev.filter((id) => id !== userId));
      setBlockedUserIds((prev) => prev.filter((id) => id !== userId));
      setPinnedUserIds((prev) => prev.filter((id) => id !== userId));
      setUnreadCounts((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
    setActionUser(null);
  };

  const startCall = async (targetUserId: string, targetUserUniqueId?: string) => {
    const callPayload = await createOutgoingCallInvite(targetUserId, targetUserUniqueId, "video");
    if (!callPayload) return;

    navigate(`/call/${encodeURIComponent(callPayload.callRoomID)}`, {
      state: {
        ...callPayload,
        returnTo: "/home",
      },
    });
  };

  const handleAcceptRequest = async (requestId: string) => {
    await supabase.rpc("accept_contact_request", { _request_id: requestId });
    await Promise.all([fetchPendingRequests(), refreshUsers()]);
  };

  const handleDeclineRequest = async (requestId: string) => {
    await supabase.from("contact_requests").update({ status: "declined" }).eq("id", requestId);
    await fetchPendingRequests();
  };

  const visibleCallHistory = appMode === "online" ? callHistory : [];
  const usersById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);

  return (
    <main className="app-wallpaper-bg mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="relative flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground shadow-card" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        {showRecentCalls ? (
          <div className="flex min-h-9 items-center">
            <h1 className="text-xl font-semibold">Recent Call</h1>
          </div>
        ) : (
          <>
            <div className="flex min-h-9 items-center">
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <Wifi className="h-5 w-5" />
                AirTalk
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <Button
                className="h-9 gap-1 px-2 dark:text-foreground dark:ring-1 dark:ring-accent/40"
                onClick={() => setAppMode(appMode === "online" ? "offline" : "online")}
                size="sm"
                variant="secondary"
              >
                <Globe2 className="h-4 w-4" />
                {appMode === "online" ? "Switch to Offline" : "Switch to Online"}
              </Button>
            </div>
          </>
        )}
      </header>

      

      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 px-4" onClick={() => setNotificationsOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-3 shadow-card" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-card-foreground">{t("home.notifications")}</p>
              <Button onClick={() => setNotificationsOpen(false)} size="icon" variant="ghost" className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {pendingRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("home.noPending")}</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {pendingRequests.map((request) => (
                  <div className="rounded-xl border border-border bg-background p-2" key={request.id}>
                    <p className="text-xs text-muted-foreground">{t("home.friendRequest")}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <img
                        alt={`${request.senderName} avatar`}
                        className="h-8 w-8 rounded-full border border-border object-cover"
                        src={request.senderAvatarUrl ?? getAvatarTemplateBySeed(request.senderName).dataUrl}
                      />
                      <p className="truncate text-sm font-semibold text-card-foreground">{request.senderName}</p>
                    </div>
                    {request.requestMessage && <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">“{request.requestMessage}”</p>}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button className="h-8" onClick={() => void handleAcceptRequest(request.id)} size="sm">
                          {t("common.accept")}
                        </Button>
                        <Button className="h-8" onClick={() => void handleDeclineRequest(request.id)} size="sm" variant="outline">
                          {t("common.decline")}
                        </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {(pullDistance > 0 || isRefreshing) && (
        <div className="px-3 pt-2">
          <div className="rounded-full border border-border bg-card px-3 py-1 text-center text-xs text-muted-foreground shadow-sm">
            {isRefreshing ? "Refreshing app..." : readyToRefresh ? "Release to refresh" : "Pull down to refresh"}
          </div>
        </div>
      )}

      <section
        {...bindPullToRefresh}
        className="flex-1 space-y-2 overflow-y-auto p-3 pb-28"
        ref={listScrollRef}
      >
        {showRecentCalls ? (
          <>

            {visibleCallHistory.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-card">
                <p className="text-sm font-medium text-card-foreground">No recent calls yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">Start a call and it will appear here.</p>
              </div>
            ) : (
              <div className="max-h-[calc(100dvh-14.5rem)] space-y-2 overflow-y-auto pr-1">
                {visibleCallHistory.map((entry) => {
                  const startedAtDate = new Date(entry.startedAt);
                  const endedAtDate = entry.durationSeconds ? new Date(startedAtDate.getTime() + entry.durationSeconds * 1000) : null;
                  const peerProfile = usersById.get(entry.peerUserId);

                  return (
                    <div className="rounded-2xl border border-border bg-card p-3 shadow-card" key={entry.id}>
                      <div className="flex items-center gap-3">
                        <img
                          alt={`${entry.peerName} profile`}
                          className="h-12 w-12 rounded-full border border-border object-cover"
                          src={entry.peerAvatarUrl ?? getAvatarTemplateBySeed(entry.peerName).dataUrl}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-card-foreground">{entry.peerName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {entry.callType === "voice" ? "Voice" : "Video"} • {entry.direction === "incoming" ? "Incoming" : "Outgoing"} • {entry.status}
                          </p>
                        </div>
                        <Button
                          className="h-10 w-10 dark:text-foreground dark:ring-1 dark:ring-accent/35"
                          onClick={() => startCall(entry.peerUserId, peerProfile?.uniqueId)}
                          size="icon"
                          type="button"
                          variant="secondary"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/70 p-2 text-[11px] text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Duration:</span> {formatCallDuration(entry.durationSeconds)}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Date:</span> {startedAtDate.toLocaleDateString()}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Started:</span> {formatTime12(entry.startedAt)}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Ended:</span> {endedAtDate ? formatTime12(endedAtDate.toISOString()) : "--"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {showPermissionStatus && (
              <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-card-foreground">{t("home.permissionStatus")}</p>
                    {missingPermissions.length > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">{t("home.missing")}: {missingPermissions.join(" • ")}</p>
                        <Button className="mt-1 h-8" onClick={() => navigate("/permissions")} size="sm" variant="outline">
                          <ShieldAlert className="h-4 w-4" />
                          {t("home.fixPermissions")}
                        </Button>
                      </>
                    ) : (
                      <p className="flex items-center gap-1 text-xs font-medium text-accent">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {t("home.allPermissions")}
                      </p>
                    )}
                  </div>
                  <Button
                    aria-label="Close permission status"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      setShowPermissionStatus(false);
                      if (missingPermissions.length === 0) {
                        localStorage.setItem(PERMISSION_POPUP_DISMISSED_KEY, "true");
                      }
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button
                className={`h-8 gap-1 ${
                  !showArchivedChats
                    ? "dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]"
                    : "dark:text-foreground"
                }`}
                onClick={() => setShowArchivedChats(false)}
                size="sm"
                variant={showArchivedChats ? "secondary" : "default"}
              >
                Chats
              </Button>
              <Button
                className={`h-8 gap-1 ${
                  showArchivedChats
                    ? "dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]"
                    : "dark:text-foreground"
                }`}
                onClick={() => setShowArchivedChats(true)}
                size="sm"
                variant={showArchivedChats ? "default" : "secondary"}
              >
                <Archive className="h-4 w-4" />
                Archived chats
              </Button>
            </div>

            {(showArchivedChats ? archivedUsers : visibleUsers).length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-card">
                <p className="text-sm font-medium text-card-foreground">
                  {showArchivedChats ? "No archived chats" : appMode === "online" ? t("home.noOnlineUsers") : t("home.noOfflineUsers")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {showArchivedChats ? "Hold a user in chats list and choose archive." : appMode === "online" ? t("home.noOnlineHint") : t("home.noOfflineHint")}
                </p>
              </div>
            ) : (
              (showArchivedChats ? archivedUsers : visibleUsers).map((user) => {
                const messages = getMessagesForUser(user.id);
                const latestMessage = messages[messages.length - 1];
                const unreadCount = unreadCounts[user.id] ?? 0;
                const preview = latestMessage?.text?.trim()
                  ? `${latestMessage.direction === "sent" ? `${t("home.youPrefix")} ` : ""}${latestMessage.text}`
                  : latestMessage?.attachment
                    ? `${latestMessage.direction === "sent" ? t("home.you") : user.name} ${t("home.sentAttachment")}`
                    : t("home.tapToChat");

                const peerRecentlySeen = Boolean(user.lastSeen && Date.now() - new Date(user.lastSeen).getTime() < 45000);
                const isUserOnline =
                  appMode === "online"
                    ? isAppOnline && Boolean(user.onlineStatus || peerRecentlySeen)
                    : Boolean(user.source === "wifi-direct" || user.onlineStatus || peerRecentlySeen);
                const pingMs = isUserOnline ? currentPing : 999;
                const signalQuality = isUserOnline ? getSignalQuality(pingMs) : "offline";
                const signalLabel = signalQuality === "offline" ? t("common.offline") : signalQuality === "excellent" ? "Excellent" : signalQuality === "stable" ? "Stable" : "Weak";
                const signalColorClass =
                  signalQuality === "excellent"
                    ? "text-signal-excellent"
                    : signalQuality === "stable"
                      ? "text-signal-stable"
                      : signalQuality === "weak"
                        ? "text-signal-weak"
                        : "text-muted-foreground";
                const rangeLabel = isUserOnline ? getRangeLabel(pingMs) : "--";

                return (
                  <div className="flex items-center gap-2" key={user.id}>
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-transparent bg-card px-3 py-3 text-left transition hover:border-border hover:bg-muted"
                      onClick={() => openChat(user.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openActionSheet(user);
                      }}
                      onMouseDown={() => beginHoldUser(user)}
                      onMouseLeave={clearHoldTimer}
                      onMouseUp={clearHoldTimer}
                      onTouchCancel={clearHoldTimer}
                      onTouchEnd={clearHoldTimer}
                      onTouchStart={() => beginHoldUser(user)}
                      type="button"
                    >
                      <img
                        alt={`${user.name} profile`}
                        className="h-12 w-12 rounded-full border border-border object-cover"
                        src={user.avatarUrl ?? getAvatarTemplateBySeed(user.uniqueId ?? user.name).dataUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-card-foreground">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{preview}</p>
                        {appMode === "offline" ? (
                          <>
                            <p className={`truncate text-[11px] ${signalColorClass}`}>
                              {isUserOnline ? `${t("scan.nearby")} • ${pingMs}ms • ${signalLabel}` : `${t("common.offline")} • --ms • ${t("common.offline")}`}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">WiFi Direct/Bluetooth Nearby • {t("home.range")}: {rangeLabel}</p>
                          </>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {pinnedUserSet.has(user.id) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </span>
                        )}
                        {appMode === "online" ? (
                          <span className={`text-xs font-medium ${isUserOnline ? "text-signal-excellent" : "text-destructive"}`}>
                            {isUserOnline ? t("common.online") : t("common.offline")}
                          </span>
                        ) : (
                          <div className={`flex items-center gap-1 ${signalColorClass}`}>
                            <SignalHigh className="h-4 w-4" />
                            <span className="text-xs font-medium">{signalLabel}</span>
                          </div>
                        )}
                        {unreadCount > 0 && !showArchivedChats && (
                          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </button>

                    {!showArchivedChats && (
                      <Button
                        className="h-11 w-11 dark:text-foreground dark:ring-1 dark:ring-accent/35"
                        onClick={() => startCall(user.id, user.uniqueId)}
                        size="icon"
                        type="button"
                        variant="secondary"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </section>

      <UserHoldOptionsDialog
        isArchived={Boolean(actionUser && archivedUserSet.has(actionUser.id))}
        isBlocked={Boolean(actionUser && blockedUserSet.has(actionUser.id))}
        isPinned={Boolean(actionUser && pinnedUserSet.has(actionUser.id))}
        onClose={() => setActionUser(null)}
        onDelete={() => void handleDeleteUser()}
        onToggleArchive={toggleArchiveUser}
        onToggleBlock={toggleBlockUser}
        onTogglePin={togglePinUser}
        open={Boolean(actionUser)}
        userName={actionUser?.name ?? ""}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-0">
        <div className="pointer-events-auto mx-auto grid w-full max-w-md grid-cols-4 gap-2 border-t border-border bg-card px-3 py-2">
          <Button
            className={`active:scale-95 transition-transform ${
              !showRecentCalls ? "dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]" : "dark:text-foreground"
            }`}
            onClick={() => setShowRecentCalls(false)}
            size="sm"
            variant={!showRecentCalls ? "default" : "secondary"}
          >
            <House className="h-4 w-4" />
            {t("common.home")}
          </Button>
          <Button
            className={`active:scale-95 transition-transform ${
              showRecentCalls ? "dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]" : "dark:text-foreground"
            }`}
            onClick={() => setShowRecentCalls(true)}
            size="sm"
            variant={showRecentCalls ? "default" : "secondary"}
          >
            <History className="h-4 w-4" />
            History
          </Button>
          <Button className="active:scale-95 transition-transform dark:text-foreground" onClick={() => navigate("/scan")} size="sm" variant="secondary">
            <Radar className="h-4 w-4" />
            {t("common.scan")}
          </Button>
          <Button className="active:scale-95 transition-transform dark:text-foreground" onClick={() => navigate("/settings")} size="sm" variant="secondary">
            <Settings className="h-4 w-4" />
            {t("common.settings")}
          </Button>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
