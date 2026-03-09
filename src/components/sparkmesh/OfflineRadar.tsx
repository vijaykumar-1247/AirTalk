import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Radar, Signal, Wifi, AlertCircle } from 'lucide-react';
import { useHybridP2P, type OfflinePeerUIState } from '@/hooks/useHybridP2P';

interface OfflineRadarProps {
  localUserId: string;
  localUserName: string;
  localDeviceId: string;
  onActiveUsersChange?: (users: OfflinePeerUIState[]) => void;
}

export function OfflineRadar({
  localUserId,
  localUserName,
  localDeviceId,
  onActiveUsersChange,
}: OfflineRadarProps) {
  const p2p = useHybridP2P(localUserId, localUserName, localDeviceId);
  const [selectedPeer, setSelectedPeer] = useState<OfflinePeerUIState | null>(null);
  const [pendingCredentials, setPendingCredentials] = useState<{
    peerId: string;
    peerName: string;
    wifiSSID: string;
    wifiPassword: string;
  } | null>(null);

  // Notify parent of active users
  useEffect(() => {
    onActiveUsersChange?.(p2p.activePeers);
  }, [p2p.activePeers, onActiveUsersChange]);

  const handlePeerClick = (peer: OfflinePeerUIState) => {
    p2p.selectPeer(peer.peerId);
    setSelectedPeer(peer);

    if (peer.phase === 'ble-discovered') {
      // Send connection request
      void p2p.sendConnectionRequest(peer.peerId);
    }
  };

  const handleAcceptConnection = async (
    peerId: string,
    wifiSSID: string,
    wifiPassword: string
  ) => {
    const success = await p2p.acceptConnection(peerId, wifiSSID, wifiPassword);
    setPendingCredentials(null);
    if (success) {
      setSelectedPeer(null);
    }
  };

  const handleRejectConnection = () => {
    setPendingCredentials(null);
  };

  const getRangeColor = (distance?: number): string => {
    if (!distance) return 'text-gray-500';
    if (distance < 5) return 'text-green-600';
    if (distance < 15) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPhaseLabel = (phase: string): string => {
    const labels: Record<string, string> = {
      'ble-discovered': 'Nearby',
      'connection-requested': 'Requesting',
      'credentials-received': 'Credentials Ready',
      'wifi-connected': 'Connected',
      'messaging-ready': 'Online',
    };
    return labels[phase] || phase;
  };

  const getPhaseColor = (phase: string): string => {
    const colors: Record<string, string> = {
      'ble-discovered': 'bg-blue-100 text-blue-800',
      'connection-requested': 'bg-yellow-100 text-yellow-800',
      'credentials-received': 'bg-purple-100 text-purple-800',
      'wifi-connected': 'bg-green-100 text-green-800',
      'messaging-ready': 'bg-green-100 text-green-800',
    };
    return colors[phase] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full space-y-4">
      {/* Radar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              <CardTitle>Offline Radar</CardTitle>
            </div>
            {p2p.isDiscovering && (
              <Badge variant="outline" className="animate-pulse">
                Scanning...
              </Badge>
            )}
          </div>
          <CardDescription>
            Discovered {p2p.discoveredPeers.length} nearby • Connected{' '}
            {p2p.activePeers.length}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Active Connected Peers */}
      {p2p.activePeers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-green-700 flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Active Connections ({p2p.activePeers.length})
          </h3>
          {p2p.activePeers.map((peer) => (
            <PeerCard
              key={peer.peerId}
              peer={peer}
              isSelected={selectedPeer?.peerId === peer.peerId}
              onClick={() => handlePeerClick(peer)}
              getRangeColor={getRangeColor}
              getPhaseLabel={getPhaseLabel}
              getPhaseColor={getPhaseColor}
              unreadCount={p2p.unreadCounts.get(peer.peerId) || 0}
            />
          ))}
        </div>
      )}

      {/* Discovered Peers Waiting for Answer */}
      {p2p.requestingPeers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Pending Requests ({p2p.requestingPeers.length})
          </h3>
          {p2p.requestingPeers.map((peer) => (
            <PeerCard
              key={peer.peerId}
              peer={peer}
              isSelected={selectedPeer?.peerId === peer.peerId}
              onClick={() => handlePeerClick(peer)}
              getRangeColor={getRangeColor}
              getPhaseLabel={getPhaseLabel}
              getPhaseColor={getPhaseColor}
            />
          ))}
        </div>
      )}

      {/* Discovered Peers */}
      {p2p.discoveredPeers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-blue-700 flex items-center gap-2">
            <Signal className="h-4 w-4" />
            Nearby Peers ({p2p.discoveredPeers.length})
          </h3>
          {p2p.discoveredPeers.map((peer) => (
            <PeerCard
              key={peer.peerId}
              peer={peer}
              isSelected={selectedPeer?.peerId === peer.peerId}
              onClick={() => handlePeerClick(peer)}
              getRangeColor={getRangeColor}
              getPhaseLabel={getPhaseLabel}
              getPhaseColor={getPhaseColor}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {p2p.peerStates.length === 0 && !p2p.isDiscovering && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Radar className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No nearby peers found</p>
          </CardContent>
        </Card>
      )}

      {/* Connection Request Dialog */}
      <AlertDialog
        open={pendingCredentials !== null}
        onOpenChange={(open) => !open && handleRejectConnection()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connection Request from {pendingCredentials?.peerName}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2 mt-4">
                <p className="text-sm">
                  Ready to connect to the <strong>{pendingCredentials?.wifiSSID}</strong> network?
                </p>
                <div className="bg-gray-100 p-3 rounded text-xs space-y-1">
                  <p>SSID: {pendingCredentials?.wifiSSID}</p>
                  <p>Range: ~100 meters</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel onClick={handleRejectConnection}>Decline</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingCredentials) {
                  void handleAcceptConnection(
                    pendingCredentials.peerId,
                    pendingCredentials.wifiSSID,
                    pendingCredentials.wifiPassword
                  );
                }
              }}
            >
              Accept & Connect
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface PeerCardProps {
  peer: OfflinePeerUIState;
  isSelected: boolean;
  onClick: () => void;
  getRangeColor: (distance?: number) => string;
  getPhaseLabel: (phase: string) => string;
  getPhaseColor: (phase: string) => string;
  unreadCount?: number;
}

function PeerCard({
  peer,
  isSelected,
  onClick,
  getRangeColor,
  getPhaseLabel,
  getPhaseColor,
  unreadCount = 0,
}: PeerCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{peer.peerName}</p>
              <Badge className={getPhaseColor(peer.phase)}>
                {getPhaseLabel(peer.phase)}
              </Badge>
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              {peer.bleDistance !== undefined && (
                <span className={`flex items-center gap-1 ${getRangeColor(peer.bleDistance)}`}>
                  <Signal className="h-3 w-3" />
                  {peer.bleDistance.toFixed(1)}m
                </span>
              )}
              {peer.wifiIPv4 && (
                <span className="flex items-center gap-1 text-green-600">
                  <Wifi className="h-3 w-3" />
                  {peer.wifiIPv4}
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            {peer.phase === 'ble-discovered' ? 'Tap to Connect' : 'View'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
