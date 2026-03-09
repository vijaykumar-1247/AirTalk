import { Capacitor } from "@capacitor/core";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Smartphone, Wrench, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getMissingPermissions, loadPermissionStatuses } from "@/lib/permission-status";
import { WifiDirectTransport } from "@/plugins/wifi-direct-transport";

type DeviceDiagnosticsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DiagnosticStatus = "idle" | "loading" | "passed" | "warning" | "failed";

type DiagnosticItem = {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
};

const baseItems: Array<Omit<DiagnosticItem, "status" | "detail">> = [
  { id: "wifi-direct", label: "Wi-Fi Direct Adapter Status" },
  { id: "bluetooth-nearby", label: "Bluetooth & Nearby Share Status" },
  { id: "p2p-permissions", label: "Peer-to-Peer (P2P) Permissions" },
  { id: "network-storage", label: "Network Sync & Storage Access" },
];

const buildInitialItems = (): DiagnosticItem[] =>
  baseItems.map((entry) => ({
    ...entry,
    status: "idle",
    detail: "Waiting to run",
  }));

const DeviceDiagnosticsModal = ({ open, onOpenChange }: DeviceDiagnosticsModalProps) => {
  const [items, setItems] = useState<DiagnosticItem[]>(() => buildInitialItems());
  const [isRunning, setIsRunning] = useState(false);

  const isNativePlatform = Capacitor.isNativePlatform();
  const isAndroidNative = isNativePlatform && Capacitor.getPlatform() === "android";

  const runDiagnostics = () => {
    setItems(buildInitialItems());
    setIsRunning(true);
  };

  useEffect(() => {
    if (!open) return;
    runDiagnostics();
  }, [open]);

  useEffect(() => {
    if (!open || !isRunning) return;

    let cancelled = false;

    const applyResult = (id: string, status: DiagnosticStatus, detail: string) => {
      setItems((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status, detail } : entry)));
    };

    const execute = async () => {
      const permissionStatuses = loadPermissionStatuses();
      const missingPermissionLabels = getMissingPermissions(permissionStatuses);

      for (const item of baseItems) {
        if (cancelled) return;
        applyResult(item.id, "loading", "Checking…");

        if (item.id === "wifi-direct") {
          if (!isAndroidNative) {
            applyResult(item.id, "warning", "Web preview: Wi-Fi Direct hardware check unavailable. Test in Android native app.");
            continue;
          }

          if (!Capacitor.isPluginAvailable("WifiDirectTransport")) {
            applyResult(item.id, "failed", "WifiDirectTransport plugin not available on this build.");
            continue;
          }

          try {
            await WifiDirectTransport.getDiscoveredPeers();
            applyResult(item.id, "passed", "Wi-Fi Direct adapter is reachable.");
          } catch {
            applyResult(item.id, "failed", "Unable to access Wi-Fi Direct adapter. Check Android permissions/settings.");
          }
          continue;
        }

        if (item.id === "bluetooth-nearby") {
          if (!isAndroidNative) {
            applyResult(item.id, "warning", "Web preview cannot verify Bluetooth/Nearby hardware state.");
            continue;
          }

          if (permissionStatuses.bluetoothLocation === "granted") {
            applyResult(item.id, "passed", "Bluetooth + location permission granted.");
          } else {
            applyResult(item.id, "failed", "Bluetooth/Location permission is not granted.");
          }
          continue;
        }

        if (item.id === "p2p-permissions") {
          if (!isAndroidNative) {
            applyResult(item.id, "warning", "P2P permission validation requires Android native runtime.");
            continue;
          }

          if (missingPermissionLabels.length === 0) {
            applyResult(item.id, "passed", "All required P2P permissions are granted.");
          } else {
            applyResult(item.id, "failed", `Missing: ${missingPermissionLabels.join(", ")}`);
          }
          continue;
        }

        if (item.id === "network-storage") {
          const canUseStorage = (() => {
            try {
              localStorage.setItem("sparkmesh_diag_ping", "ok");
              localStorage.removeItem("sparkmesh_diag_ping");
              return true;
            } catch {
              return false;
            }
          })();

          if (!canUseStorage) {
            applyResult(item.id, "failed", "Local storage is blocked. Offline sync cache cannot run.");
            continue;
          }

          if (!isAndroidNative) {
            applyResult(item.id, "warning", "Storage works, but network sync is simulated in web preview.");
            continue;
          }

          const networkStatus = navigator.onLine ? "online" : "offline";
          applyResult(item.id, "passed", `Storage available. Current network state: ${networkStatus}.`);
        }
      }

      if (!cancelled) setIsRunning(false);
    };

    void execute();

    return () => {
      cancelled = true;
    };
  }, [isAndroidNative, isRunning, open]);

  const completedCount = useMemo(
    () => items.filter((item) => item.status === "passed" || item.status === "warning" || item.status === "failed").length,
    [items]
  );

  const statusIcon = (status: DiagnosticStatus) => {
    if (status === "passed") return <CheckCircle2 className="h-4 w-4 text-accent" />;
    if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === "warning") return <AlertTriangle className="h-4 w-4 text-signal-stable" />;
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Device diagnostics
          </DialogTitle>
          <DialogDescription>
            Running environment checks ({completedCount}/{items.length})
          </DialogDescription>
        </DialogHeader>

        {!isAndroidNative && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
            <p className="flex items-center gap-2 font-medium">
              <Smartphone className="h-3.5 w-3.5" />
              This panel is for Android native offline hardware testing.
            </p>
            <p className="mt-1 text-muted-foreground">Web preview shows simulation only.</p>
          </div>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2" key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-foreground">{item.label}</p>
                {statusIcon(item.status)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button className="dark:text-foreground" onClick={() => onOpenChange(false)} type="button" variant="outline">
            Close
          </Button>
          <Button className="gap-2 dark:text-primary-foreground dark:ring-1 dark:ring-accent/60" disabled={isRunning} onClick={runDiagnostics} type="button" variant="default">
            <RotateCcw className="h-4 w-4" />
            Retest
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceDiagnosticsModal;
