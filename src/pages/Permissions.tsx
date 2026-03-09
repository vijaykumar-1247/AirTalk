import { ArrowLeft, Bell, Bluetooth, Camera, CheckCircle2, MapPin, Mic, ShieldCheck, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSparkMesh } from "@/context/SparkMeshContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  type PermissionState,
  type PermissionStatusMap,
  loadPermissionStatuses,
  savePermissionStatuses,
} from "@/lib/permission-status";

const statusLabel: Record<PermissionState, string> = {
  idle: "Not granted",
  requesting: "Requesting...",
  granted: "Granted",
  denied: "Denied",
};

const statusTone: Record<PermissionState, string> = {
  idle: "bg-muted text-muted-foreground",
  requesting: "bg-secondary text-secondary-foreground",
  granted: "bg-accent/15 text-accent",
  denied: "bg-destructive/10 text-destructive",
};

const Permissions = () => {
  const navigate = useNavigate();
  const { completePermissionSetup } = useSparkMesh();
  const [permissions, setPermissions] = useState<PermissionStatusMap>(() => loadPermissionStatuses());
  const [showBluetoothPrompt, setShowBluetoothPrompt] = useState(false);
  const swipeStartYRef = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const canEnterApp = useMemo(
    () => Object.values(permissions).filter((status) => status === "granted").length >= 2,
    [permissions]
  );

  useEffect(() => {
    savePermissionStatuses(permissions);
  }, [permissions]);

  const updatePermission = (key: keyof PermissionStatusMap, value: PermissionState) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const requestBluetoothLocation = () => {
    setSwipeOffset(0);
    setShowBluetoothPrompt(true);
  };

  const requestLocalStorage = () => {
    updatePermission("localStorage", "requesting");
    window.setTimeout(() => updatePermission("localStorage", "granted"), 350);
  };

  const requestMediaPermission = async () => {
    updatePermission("media", "requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      updatePermission("media", "granted");
    } catch {
      updatePermission("media", "denied");
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      updatePermission("notifications", "granted");
      return;
    }

    updatePermission("notifications", "requesting");
    const result = await Notification.requestPermission();
    updatePermission("notifications", result === "granted" ? "granted" : "denied");
  };

  const closeBluetoothPrompt = () => {
    setSwipeOffset(0);
    setShowBluetoothPrompt(false);
  };

  const handlePopupTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    swipeStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handlePopupTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const startY = swipeStartYRef.current;
    if (startY == null) return;
    const delta = (event.touches[0]?.clientY ?? startY) - startY;
    setSwipeOffset(Math.max(0, delta));
  };

  const handlePopupTouchEnd = () => {
    if (swipeOffset > 90) {
      closeBluetoothPrompt();
    } else {
      setSwipeOffset(0);
    }
    swipeStartYRef.current = null;
  };

  const continueToApp = () => {
    if (!canEnterApp) return;
    completePermissionSetup();
    navigate("/home", { replace: true });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background p-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <Button className="gap-2" onClick={() => navigate("/login", { replace: true })} type="button" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Button>
        <section className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-foreground">Require Access for Offline Mesh</h1>
          <p className="mt-1 text-sm text-muted-foreground">Allow at least 2 permissions before entering AirTalk home.</p>
        </section>
        <span aria-hidden className="h-10 w-10" />
      </header>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Hardware Permissions
          </CardTitle>
          <CardDescription>Grant any 2 permissions to unlock offline discovery, calls, and requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            className="w-full rounded-lg border border-border px-3 py-3 text-left transition hover:bg-muted"
            onClick={requestBluetoothLocation}
            type="button"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Bluetooth className="h-4 w-4" />
                Bluetooth & Location
              </p>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusTone[permissions.bluetoothLocation]}`}>
                {statusLabel[permissions.bluetoothLocation]}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              For Wi-Fi Direct Nearby Discovery
            </p>
          </button>

          <button
            className="w-full rounded-lg border border-border px-3 py-3 text-left transition hover:bg-muted"
            onClick={requestLocalStorage}
            type="button"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Smartphone className="h-4 w-4" />
                Local Storage
              </p>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusTone[permissions.localStorage]}`}>
                {statusLabel[permissions.localStorage]}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">To save offline files</p>
          </button>

          <button
            className="w-full rounded-lg border border-border px-3 py-3 text-left transition hover:bg-muted"
            onClick={() => void requestMediaPermission()}
            type="button"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mic className="h-4 w-4" />
                Microphone & Camera
              </p>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusTone[permissions.media]}`}>
                {statusLabel[permissions.media]}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="h-3.5 w-3.5" />
              For Offline Voice/Video Calls
            </p>
          </button>

          <button
            className="w-full rounded-lg border border-border px-3 py-3 text-left transition hover:bg-muted"
            onClick={() => void requestNotificationPermission()}
            type="button"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Bell className="h-4 w-4" />
                Notifications
              </p>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusTone[permissions.notifications]}`}>
                {statusLabel[permissions.notifications]}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">For incoming Air Talk Requests</p>
          </button>
        </CardContent>
      </Card>

      <Button className="mt-4 w-full gap-2" disabled={!canEnterApp} onClick={continueToApp} type="button" variant="default">
        <CheckCircle2 className="h-4 w-4" />
        Complete Setup & Enter App
      </Button>

      {showBluetoothPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/65 p-4 sm:items-center" onClick={closeBluetoothPrompt}>
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-card transition-transform duration-200"
            onClick={(event) => event.stopPropagation()}
            onTouchEnd={handlePopupTouchEnd}
            onTouchMove={handlePopupTouchMove}
            onTouchStart={handlePopupTouchStart}
            style={{ transform: `translateY(${swipeOffset}px)` }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" />
            <p className="text-sm font-semibold text-foreground">Allow AirTalk to use nearby Bluetooth devices and precise location?</p>
            <p className="mt-2 text-xs text-muted-foreground">Needed for nearby offline mesh discovery and secure handshakes.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  updatePermission("bluetoothLocation", "denied");
                  closeBluetoothPrompt();
                }}
                variant="outline"
              >
                <X className="h-4 w-4" />
                Deny
              </Button>
              <Button
                onClick={() => {
                  updatePermission("bluetoothLocation", "granted");
                  closeBluetoothPrompt();
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Allow
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Permissions;

