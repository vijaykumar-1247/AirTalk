import { Capacitor } from "@capacitor/core";
import { Info, RadioTower, Router, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DeviceDiagnosticsModal from "@/components/settings/DeviceDiagnosticsModal";
import { WifiDirectTransport, type WifiDirectPeer } from "@/plugins/wifi-direct-transport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

type NetworkSectionProps = {
  autoScan: boolean;
  lowDataMode: boolean;
  currentPing: number;
  onAutoScanChange: (value: boolean) => void;
  onLowDataModeChange: (value: boolean) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getRangeMetersFromPeer = (peer: WifiDirectPeer) => {
  if (typeof peer.rangeMeters === "number" && Number.isFinite(peer.rangeMeters) && peer.rangeMeters > 0) {
    return peer.rangeMeters;
  }

  if (typeof peer.signalStrength === "number" && Number.isFinite(peer.signalStrength)) {
    const normalized = clamp((peer.signalStrength + 90) / 55, 0, 1);
    return Math.round(35 - normalized * 32);
  }

  return null;
};

const NetworkSection = ({ autoScan, lowDataMode, currentPing, onAutoScanChange, onLowDataModeChange }: NetworkSectionProps) => {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [isRangeScanActive, setIsRangeScanActive] = useState(false);
  const [isRangeLoading, setIsRangeLoading] = useState(false);
  const [rangePeers, setRangePeers] = useState<WifiDirectPeer[]>([]);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [lastRangeUpdatedAt, setLastRangeUpdatedAt] = useState<string | null>(null);

  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const refreshRange = useCallback(async () => {
    if (!isNativeAndroid) {
      setRangeError("Range indicator is available on Android native build.");
      return;
    }

    setIsRangeLoading(true);
    setRangeError(null);

    try {
      await WifiDirectTransport.startDiscovery();
      const { peers } = await WifiDirectTransport.getDiscoveredPeers();
      setRangePeers(peers);
      setLastRangeUpdatedAt(new Date().toISOString());
    } catch {
      setRangeError("Could not read Wi-Fi Direct range data.");
    } finally {
      setIsRangeLoading(false);
    }
  }, [isNativeAndroid]);

  useEffect(() => {
    if (!isRangeScanActive) return;

    void refreshRange();
    const intervalId = window.setInterval(() => {
      void refreshRange();
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [isRangeScanActive, refreshRange]);

  useEffect(() => {
    if (!isRangeScanActive || !isNativeAndroid) return;

    return () => {
      void WifiDirectTransport.stopDiscovery();
    };
  }, [isNativeAndroid, isRangeScanActive]);

  const strongestSignal = useMemo(() => {
    const values = rangePeers
      .map((peer) => peer.signalStrength)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (values.length === 0) return null;
    return Math.max(...values);
  }, [rangePeers]);

  const estimatedRangeMeters = useMemo(() => {
    const values = rangePeers.map(getRangeMetersFromPeer).filter((value): value is number => typeof value === "number");
    if (values.length > 0) return Math.min(...values);

    return clamp(Math.round((currentPing / 200) * 35), 3, 35);
  }, [currentPing, rangePeers]);

  const rangeProgressValue = useMemo(() => {
    const normalized = 100 - (estimatedRangeMeters / 35) * 100;
    return clamp(Math.round(normalized), 0, 100);
  }, [estimatedRangeMeters]);

  const handleToggleRangeScan = async () => {
    if (isRangeScanActive) {
      setIsRangeScanActive(false);
      if (isNativeAndroid) {
        await WifiDirectTransport.stopDiscovery();
      }
      return;
    }

    setIsRangeScanActive(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-accent">
          <Router className="h-4 w-4" />
          Network Options
        </CardTitle>
        <CardDescription>Connection behavior for both online and offline modes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full justify-between" type="button" variant="outline">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Network Functions
              </span>
              <span className="text-xs text-muted-foreground">Open</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Network Functions</DialogTitle>
              <DialogDescription>Control scan behavior, data usage, and Wi-Fi Direct range from one place.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <Label className="text-sm font-medium">Auto-scan nearby devices</Label>
                  <p className="text-xs text-muted-foreground">Keep refreshing nearby peer discovery</p>
                </div>
                <Switch checked={autoScan} onCheckedChange={onAutoScanChange} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <Label className="text-sm font-medium">Low data mode</Label>
                  <p className="text-xs text-muted-foreground">Prioritize text and lower-size media delivery</p>
                </div>
                <Switch checked={lowDataMode} onCheckedChange={onLowDataModeChange} />
              </div>

              <div className="space-y-2 rounded-lg border border-border px-3 py-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <RadioTower className="h-4 w-4" />
                    Wi-Fi Direct live range
                  </Label>
                  <span className="text-xs text-muted-foreground">~{estimatedRangeMeters}m</span>
                </div>
                <Progress value={rangeProgressValue} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Peers: {rangePeers.length}</span>
                  <span>Signal: {strongestSignal ? `${strongestSignal} dBm` : "--"}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{lastRangeUpdatedAt ? `Updated ${new Date(lastRangeUpdatedAt).toLocaleTimeString()}` : "Waiting for scan..."}</span>
                  <span>{isNativeAndroid ? "Android native" : "Web preview"}</span>
                </div>
                {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
                <Button className="w-full" disabled={isRangeLoading} onClick={() => void handleToggleRangeScan()} type="button" variant="secondary">
                  {isRangeScanActive ? "Stop live scan" : "Start live scan"}
                </Button>
              </div>

              <Button className="w-full justify-between" onClick={() => setDiagnosticsOpen(true)} type="button" variant="outline">
                <span className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Device diagnostics
                </span>
                <span className="text-xs text-muted-foreground">Run</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          These controls apply the same way in Offline and Online mode.
        </div>

        <DeviceDiagnosticsModal onOpenChange={setDiagnosticsOpen} open={diagnosticsOpen} />
      </CardContent>
    </Card>
  );
};

export default NetworkSection;

