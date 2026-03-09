import { type PluginListenerHandle } from "@capacitor/core";
import { BellRing, House, Radar, Search, Settings, ShieldCheck, Signal, UserSquare2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DefaultSenderModal from "@/components/sparkmesh/DefaultSenderModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSparkMesh } from "@/context/SparkMeshContext";
import { toast } from "@/hooks/use-toast";
import { autoReconnectKnownPeers, sendOfflineConnectionRequest, sendOriginalProfileImage, startOfflineBroadcast } from "@/lib/sparkmesh-backend";
import {
  buildBroadcastIdentifier,
  getAcceptedFriends,
  getAvatarTemplateByIndex,
  getAvatarTemplateBySeed,
  getOriginalPeerImage,
  loadDefaultSenderProfile,
  parseBroadcastIdentifier,
  profileToDefaultSender,
  saveAcceptedFriend,
  saveDefaultSenderProfile,
  saveOriginalPeerImage,
} from "@/lib/offline-p2p";
import { getPlatformSyncedDeviceId } from "@/lib/device-id";
import { useAppLanguage } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { WifiDirectTransport } from "@/plugins/wifi-direct-transport";
import type { IncomingAirTalkRequest, SparkMeshUser } from "@/types/sparkmesh";

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

const ScanNearby = () => {
  const navigate = useNavigate();
  const { profile, users, startNetworkScan, sendAirTalkRequest, currentPing, appMode, refreshUsers } = useSparkMesh();
  const { t } = useAppLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<SparkMeshUser[]>([]);
  const [requestTarget, setRequestTarget] = useState<SparkMeshUser | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [isAppOnline, setIsAppOnline] = useState(() => navigator.onLine);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<IncomingAirTalkRequest[]>([]);
  const [defaultSenderOpen, setDefaultSenderOpen] = useState(false);
  const [defaultAvatarIndex, setDefaultAvatarIndex] = useState(0);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const contentScrollRef = useRef<HTMLElement | null>(null);
  const visibleDevices = useMemo(() => (hasScanned ? scannedDevices : []), [hasScanned, scannedDevices]);
  const filteredVisibleDevices = useMemo(() => {
    if (appMode !== "online" || !activeSearch) return visibleDevices;

    return visibleDevices.filter((device) => {
      const query = activeSearch.toLowerCase();
      const nameMatch = device.name.toLowerCase().includes(query);
      const uniqueIdMatch = (device.uniqueId ?? "").toLowerCase().includes(query);
      const deviceIdMatch = device.deviceId.toLowerCase().includes(query);
      return nameMatch || uniqueIdMatch || deviceIdMatch;
    });
  }, [activeSearch, appMode, visibleDevices]);

  const fallbackName = localStorage.getItem("sparkmesh_profile_name") ?? "AirTalk Node";
  const senderName = profile?.name ?? fallbackName;
  const senderUniqueId = profile?.uniqueId ?? "UNKNOWN";
  const senderDeviceId = profile?.deviceId ?? getPlatformSyncedDeviceId();

  const getActiveSender = useCallback(() => {
    const fromStorage = loadDefaultSenderProfile();
    if (fromStorage) return fromStorage;

    const fromProfile = profileToDefaultSender(profile, defaultAvatarIndex);
    if (fromProfile) return fromProfile;

    return {
      name: senderName,
      uniqueId: senderUniqueId,
      deviceId: senderDeviceId,
      avatarIndex: defaultAvatarIndex,
      savedAt: new Date().toISOString(),
    };
  }, [defaultAvatarIndex, profile, senderDeviceId, senderName, senderUniqueId]);

  const hydrateOfflineUserCard = useCallback((device: SparkMeshUser) => {
    const parsedBroadcast = parseBroadcastIdentifier(device.name);
    const parsedName = parsedBroadcast?.name ?? device.name;
    const parsedUniqueId = parsedBroadcast?.uniqueId ?? device.uniqueId ?? "UNKNOWN";
    const parsedAvatarIndex = parsedBroadcast?.avatarIndex ?? 0;
    const originalAvatar = getOriginalPeerImage(device.deviceId);
    const fallbackTemplateAvatar = getAvatarTemplateByIndex(parsedAvatarIndex).dataUrl;

    return {
      ...device,
      name: parsedName,
      uniqueId: parsedUniqueId,
      avatarUrl: originalAvatar ?? device.avatarUrl ?? fallbackTemplateAvatar,
      avatarSeed: parsedName.toLowerCase(),
      source: "wifi-direct" as const,
    };
  }, []);

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
    const savedSender = loadDefaultSenderProfile();
    if (savedSender) {
      setDefaultAvatarIndex(savedSender.avatarIndex);
    }
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
        .channel(`scan-notifications-${currentUserId}`)
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
    let messageListener: PluginListenerHandle | null = null;
    let connectionListener: PluginListenerHandle | null = null;

    const bootstrapNativeListeners = async () => {
      try {
        messageListener = await WifiDirectTransport.addListener("messageReceived", (event) => {
          if (!event.text?.startsWith("AIRTALK_ORIGINAL_IMAGE#") || !event.attachmentBase64) return;
          const deviceId = event.text.split("#")[1]?.trim();
          if (!deviceId) return;

          const mimeType = event.mimeType?.trim() || "image/jpeg";
          const imageDataUrl = `data:${mimeType};base64,${event.attachmentBase64}`;
          saveOriginalPeerImage(deviceId, imageDataUrl);

          setScannedDevices((prev) =>
            prev.map((entry) => (entry.deviceId === deviceId ? { ...entry, avatarUrl: imageDataUrl } : entry))
          );
        });

        connectionListener = await WifiDirectTransport.addListener("peerConnectionStateChanged", (event) => {
          setConnectedPeerIds((prev) => {
            const current = new Set(prev);
            if (event.status === "connected") current.add(event.peerId);
            if (event.status === "disconnected") current.delete(event.peerId);
            return Array.from(current);
          });
        });
      } catch {
        // Native listeners unavailable in web preview.
      }
    };

    void bootstrapNativeListeners();

    return () => {
      if (messageListener) void messageListener.remove();
      if (connectionListener) void connectionListener.remove();
    };
  }, []);

  useEffect(() => {
    if (appMode !== "offline") return;

    const cycle = window.setInterval(() => {
      void (async () => {
        const acceptedFriends = getAcceptedFriends();
        if (acceptedFriends.length === 0) return;

        const discoveredUsers = await startNetworkScan();
        const wifiUsers = discoveredUsers.filter((entry) => entry.source === "wifi-direct");
        const friendPeerIds = wifiUsers
          .filter((entry) => acceptedFriends.some((friend) => friend.deviceId === entry.deviceId))
          .map((entry) => entry.id);

        if (friendPeerIds.length > 0) {
          await autoReconnectKnownPeers(friendPeerIds);
          setConnectedPeerIds((prev) => Array.from(new Set([...prev, ...friendPeerIds])));
        }
      })();
    }, 12000);

    return () => {
      window.clearInterval(cycle);
    };
  }, [appMode, startNetworkScan]);

  const handleAcceptRequest = async (requestId: string) => {
    await supabase.rpc("accept_contact_request", { _request_id: requestId });
    await Promise.all([fetchPendingRequests(), refreshUsers()]);
  };

  const handleDeclineRequest = async (requestId: string) => {
    await supabase.from("contact_requests").update({ status: "declined" }).eq("id", requestId);
    await fetchPendingRequests();
  };

  const handleScan = async () => {
    setIsScanning(true);
    setHasScanned(true);

    if (appMode === "offline") {
      const activeSender = getActiveSender();
      await startOfflineBroadcast(buildBroadcastIdentifier(activeSender));

      // Show scanning status for a few seconds
      setScannedDevices([]); // Clear previous results

      const discoveredUsers = await startNetworkScan();
      const allUsers = discoveredUsers
        .filter((entry) => entry.source === "wifi-direct" || entry.source === "bluetooth")
        .map(hydrateOfflineUserCard);

      setScannedDevices(allUsers);
      setIsScanning(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentUserId = session?.user.id;

    if (!currentUserId) {
      setScannedDevices([]);
      setIsScanning(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, unique_id, device_id, avatar_url, online_status, last_seen")
      .neq("user_id", currentUserId)
      .eq("online_status", true)
      .order("updated_at", { ascending: false });

    const databaseUsers: SparkMeshUser[] = (data ?? []).map((entry) => ({
      id: entry.user_id,
      name: entry.display_name,
      uniqueId: entry.unique_id ?? undefined,
      deviceId: entry.device_id ?? "------",
      avatarSeed: entry.display_name.toLowerCase(),
      avatarUrl: entry.avatar_url ?? undefined,
      onlineStatus: entry.online_status,
      lastSeen: entry.last_seen,
      source: "online",
    }));

    const onlineContacts = users.filter((user) => user.source === "online" && user.onlineStatus);
    const merged = new Map<string, SparkMeshUser>();
    databaseUsers.forEach((user) => merged.set(user.id, user));
    onlineContacts.forEach((user) => merged.set(user.id, user));

    setScannedDevices(Array.from(merged.values()));
    setIsScanning(false);
  };

  const openRequestModal = (device: SparkMeshUser) => {
    setRequestTarget(device);
    setRequestMessage("");
  };

  const sendRequestWithMessage = async () => {
    if (!requestTarget) return;

    if (appMode === "offline") {
      const activeSender = getActiveSender();

      await sendOfflineConnectionRequest(requestTarget.id, {
        fromName: activeSender.name,
        fromUniqueId: activeSender.uniqueId,
        fromDeviceId: activeSender.deviceId,
        avatarIndex: activeSender.avatarIndex,
        message: requestMessage,
      });

      saveAcceptedFriend({
        peerId: requestTarget.id,
        deviceId: requestTarget.deviceId,
        name: requestTarget.name,
        uniqueId: requestTarget.uniqueId,
        avatarIndex: activeSender.avatarIndex,
        acceptedAt: new Date().toISOString(),
      });

      if (profile?.avatarUrl) {
        await sendOriginalProfileImage(requestTarget.id, activeSender.deviceId, profile.avatarUrl);
      }

      setConnectedPeerIds((prev) => Array.from(new Set([...prev, requestTarget.id])));

      toast({
        title: "Offline P2P request sent",
        description: `Secure request delivered to ${requestTarget.name}`,
      });
    } else {
      await sendAirTalkRequest(requestTarget.id, requestMessage);
      toast({
        title: "Air Talk Request Sent",
        description: `Request delivered to ${requestTarget.name}`,
      });
    }

    setRequestTarget(null);
    setRequestMessage("");
  };

  const saveDefaultSender = () => {
    const saved = saveDefaultSenderProfile({
      name: senderName,
      uniqueId: senderUniqueId,
      deviceId: senderDeviceId,
      avatarIndex: defaultAvatarIndex,
    });

    toast({
      title: "Default Sender saved",
      description: `${saved.name} • ${saved.uniqueId || "UNKNOWN"} • ${getAvatarTemplateByIndex(saved.avatarIndex).id}`,
    });

    setDefaultSenderOpen(false);
  };

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

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

  const applyUserSearch = () => {
    setActiveSearch(searchInput.trim());
  };

  const scrollToTop = () => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="app-wallpaper-bg mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground shadow-card">
        <div>
            <h1 className="text-left text-lg font-semibold">{t("scan.title")}</h1>
            <p className="text-left text-xs text-primary-foreground/80">{profile?.name ?? "AirTalk Node"} • {appMode === "online" ? t("scan.onlineMode") : t("scan.offlineMode")}</p>
        </div>
        <button
          className="relative rounded-full p-2 transition hover:bg-primary-foreground/10"
          onClick={() => {
            setNotificationsOpen((prev) => !prev);
            void fetchPendingRequests();
          }}
          type="button"
        >
          <BellRing className="h-6 w-6" />
          {pendingRequests.length > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-destructive" />}
        </button>
      </header>

      <DefaultSenderModal
        deviceId={senderDeviceId}
        name={senderName}
        onAvatarSelect={setDefaultAvatarIndex}
        onOpenChange={setDefaultSenderOpen}
        onSave={saveDefaultSender}
        open={defaultSenderOpen}
        selectedAvatarIndex={defaultAvatarIndex}
        uniqueId={senderUniqueId}
      />


      {requestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 px-4" onClick={() => setRequestTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-card" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-card-foreground">{t("scan.sendRequestTo")} {requestTarget.name}</p>
              <Button className="h-7 w-7" onClick={() => setRequestTarget(null)} size="icon" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Input
              maxLength={180}
              onChange={(event) => setRequestMessage(event.target.value)}
              placeholder={t("scan.typeMessage")}
              value={requestMessage}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => setRequestTarget(null)} variant="outline">
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void sendRequestWithMessage()}>{t("common.send")}</Button>
            </div>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 px-4" onClick={() => setNotificationsOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-3 shadow-card" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-card-foreground">{t("home.notifications")}</p>
              <Button className="h-7 w-7" onClick={() => setNotificationsOpen(false)} size="icon" variant="ghost">
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

      <section className="flex-1 space-y-4 overflow-y-auto p-4 pb-32" ref={contentScrollRef}>
        <div className="rounded-3xl border border-border bg-card p-5 text-center shadow-card">
          <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
            <span className={`absolute h-40 w-40 rounded-full border border-primary/25 ${isScanning ? "animate-ping" : ""}`} />
            <span className={`absolute h-28 w-28 rounded-full border border-accent/40 ${isScanning ? "animate-ping" : ""}`} />
            <span className={`absolute h-24 w-24 ${isScanning ? "animate-spin" : ""}`}>
              <span className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-full rounded-full bg-primary/60" />
            </span>
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Radar className="h-7 w-7" />
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">{isScanning ? (appMode === "online" ? t("scan.searchingOnline") : t("scan.sweeping")) : appMode === "online" ? t("scan.readyOnline") : t("scan.readyOffline")}</p>
          <Button className="mt-4 w-full gap-2" onClick={() => void handleScan()}>
            <Signal className="h-4 w-4" />
            {t("scan.start")}
          </Button>
          <Button className="mt-2 w-full gap-2 dark:text-foreground dark:ring-1 dark:ring-accent/35" onClick={() => setDefaultSenderOpen(true)} variant="secondary">
            <UserSquare2 className="h-4 w-4" />
            {t("scan.defaultSender")}
          </Button>
        </div>

        {appMode === "online" && hasScanned && (
          <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
            <div className="flex gap-2">
              <Input
                className="bg-background"
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyUserSearch();
                  }
                }}
                placeholder="Search by username, unique ID, or device ID"
                value={searchInput}
              />
              <Button className="shrink-0 gap-1" onClick={applyUserSearch} type="button" variant="secondary">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        )}

        {!hasScanned ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-card">
            <p className="text-sm font-medium text-card-foreground">{t("scan.noUsersYet")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {appMode === "online" ? t("scan.noUsersYetOnline") : t("scan.noUsersYetOffline")}
            </p>
          </div>
        ) : filteredVisibleDevices.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-card">
            <p className="text-sm font-medium text-card-foreground">{activeSearch ? "No users match your search" : t("scan.noUsersFound")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeSearch ? "Try a different username, unique ID, or device ID." : appMode === "online" ? t("scan.noUsersFoundOnline") : t("scan.noUsersFoundOffline")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredVisibleDevices.map((device) => {
              const peerRecentlySeen = Boolean(device.lastSeen && Date.now() - new Date(device.lastSeen).getTime() < 45000);
              const isOnline =
                appMode === "online"
                  ? isAppOnline && Boolean(device.onlineStatus || peerRecentlySeen)
                  : connectedPeerIds.includes(device.id) || Boolean(device.source === "wifi-direct" || device.onlineStatus || peerRecentlySeen);

              const pingMs = isOnline ? currentPing : 999;
              const signalQuality = isOnline ? getSignalQuality(pingMs) : "offline";
              const signalLabel = signalQuality === "offline" ? t("common.offline") : signalQuality === "excellent" ? "Excellent" : signalQuality === "stable" ? "Stable" : "Weak";
              const signalColorClass =
                signalQuality === "excellent"
                  ? "text-signal-excellent"
                  : signalQuality === "stable"
                    ? "text-signal-stable"
                    : signalQuality === "weak"
                      ? "text-signal-weak"
                      : "text-muted-foreground";

              const liveSignalStrength = typeof device.signalStrength === "number" ? device.signalStrength : isOnline ? -38 - Math.min(40, Math.round(pingMs / 4)) : null;
              const estimatedRangeMeters =
                typeof device.rangeMeters === "number"
                  ? device.rangeMeters
                  : isOnline
                    ? Math.max(2, Math.min(35, Math.round((pingMs / 220) * 35)))
                    : null;

              const rangeLabel = estimatedRangeMeters ? `${estimatedRangeMeters}m` : "--";

              return (
                <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3" key={device.id}>
                  <img
                    alt={`${device.name} profile`}
                    className="h-10 w-10 rounded-full border border-border object-cover"
                    src={device.avatarUrl ?? getAvatarTemplateBySeed(device.uniqueId ?? device.name).dataUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-card-foreground">{device.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t("scan.uniqueId")}: {device.uniqueId ?? t("scan.notSet")}</p>
                    <p className="truncate text-xs text-muted-foreground">{t("scan.deviceId")}: {device.deviceId}</p>
                    {appMode === "online" ? (
                      <p className={`truncate text-[11px] ${isOnline ? "text-signal-excellent" : "text-muted-foreground"}`}>{isOnline ? t("common.online") : t("common.offline")}</p>
                    ) : (
                      <>
                        <p className={`truncate text-[11px] ${signalColorClass}`}>{isOnline ? `${t("scan.nearby")} • ${pingMs}ms • ${signalLabel}` : `${t("common.offline")} • --ms • ${t("common.offline")}`}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            Signal {liveSignalStrength ? `${liveSignalStrength} dBm` : "--"}
                          </span>
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            Range {rangeLabel}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <Button className="shrink-0" onClick={() => openRequestModal(device)} size="sm" variant="outline">
                    {t("scan.tapSendRequest")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>


      <Button
        className="fixed bottom-20 left-4 z-40 rounded-full dark:text-foreground dark:ring-1 dark:ring-accent/45 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]"
        onClick={() => navigate("/permissions")}
        size="icon"
        variant="secondary"
      >
        <ShieldCheck className="h-4 w-4" />
      </Button>

      <div className="pointer-events-none fixed inset-x-0 bottom-0">
        <div className="pointer-events-auto mx-auto grid w-full max-w-md grid-cols-3 gap-2 border-t border-border bg-card px-3 py-2">
          <Button className="active:scale-95 transition-transform dark:text-foreground" onClick={() => navigate("/home")} size="sm" variant="secondary">
            <House className="h-4 w-4" />
            {t("common.home")}
          </Button>
          <Button
            className="active:scale-95 transition-transform dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]"
            onClick={scrollToTop}
            size="sm"
            variant="default"
          >
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

export default ScanNearby;
