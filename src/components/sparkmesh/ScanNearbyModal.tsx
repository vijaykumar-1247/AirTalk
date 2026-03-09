import { ScanSearch, ShieldAlert, Square, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSparkMesh } from "@/context/SparkMeshContext";

interface ScanNearbyModalProps {
  open: boolean;
  onClose: () => void;
  onStartScan: () => void;
  onSendRequest: (userId: string) => void;
}

const ScanNearbyModal = ({ open, onClose, onStartScan, onSendRequest }: ScanNearbyModalProps) => {
  const navigate = useNavigate();
  const { permissionsCompleted, users } = useSparkMesh();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<typeof users>([]);

  const handleStartScan = () => {
    if (!permissionsCompleted) return;
    setIsScanning(true);
    onStartScan();
    setScanResults(users);
  };

  const handleStopScan = () => {
    setIsScanning(false);
    setScanResults([]);
  };

  const handleSendAirTalkRequest = (userId: string) => {
    onSendRequest(userId);
    setIsScanning(false);
  };

  const goToPermissions = () => {
    onClose();
    navigate("/permissions");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/70 px-4 pb-6 sm:items-center">
      <div className="w-full max-w-sm animate-enter rounded-3xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-card-foreground">Scan Nearby</h3>
          <button className="rounded-full p-2 text-muted-foreground transition hover:bg-muted" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {!permissionsCompleted ? (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-card-foreground">
              <ShieldAlert className="h-4 w-4" /> Missing permissions
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Grant app permissions to start scan.</p>
            <Button className="mt-3 w-full" onClick={goToPermissions} variant="outline">
              Grant permissions
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col items-center rounded-2xl border border-border bg-muted/40 py-6">
              <div className="relative flex h-24 w-24 items-center justify-center">
                {isScanning && <span className="absolute h-24 w-24 animate-ping rounded-full border border-primary/40" />}
                {isScanning && <span className="absolute h-16 w-16 animate-ping rounded-full border border-primary/60" />}
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <ScanSearch className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {isScanning ? "Scanning for nearby users..." : "Tap Start to begin radar scan"}
              </p>
            </div>

            {scanResults.length > 0 && (
              <div className="mb-4 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-2">
                {scanResults.map((user) => (
                  <button
                    className="flex w-full items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-left transition hover:bg-muted"
                    key={user.id}
                    onClick={() => handleSendAirTalkRequest(user.id)}
                  >
                    <p className="text-sm font-medium text-card-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">Tap to send request</p>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button className="gap-2" onClick={handleStartScan}>
                <ScanSearch className="h-4 w-4" />
                Start
              </Button>
              <Button className="gap-2" disabled={!isScanning} onClick={handleStopScan} variant="secondary">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ScanNearbyModal;

