/**
 * Wi-Fi Direct / Hotspot Management
 * Creates and manages local Wi-Fi networks for P2P connectivity
 * Phase 3: Long-range high-bandwidth connections
 */

export interface WiFiDirectConfig {
  ssid: string;
  password: string;
  port: number;
  groupOwnerIPv4: string;
}

export interface WiFiDirectPeer {
  peerId: string;
  peerName: string;
  ipv4Address: string;
  macAddress?: string;
  connectTime: number;
  signalStrength?: number;
}

class WiFiDirectEngine {
  private isGroupOwner = false;
  private config: WiFiDirectConfig | null = null;
  private connectedPeers = new Map<string, WiFiDirectPeer>();
  private peerCallbacks: ((peers: WiFiDirectPeer[]) => void)[] = [];

  /**
   * Start Wi-Fi Direct Group (use this device as Group Owner/Hotspot)
   * Generates SSID and password, starts HTTP server for peer detection
   */
  async startGroupOwner(deviceId: string, deviceName: string, port: number = 9000): Promise<WiFiDirectConfig | null> {
    try {
      console.log(`[WiFiDirect] Starting Group Owner on port ${port}`);

      // For web implementation, we simulate this
      // In a real native app, this would use Android's Wi-Fi Direct APIs
      const ssid = `AT-${deviceId.slice(-6).toUpperCase()}-GO`;
      const password = this.generatePassword();
      const groupOwnerIPv4 = '192.168.49.1';

      this.config = {
        ssid,
        password,
        port,
        groupOwnerIPv4,
      };

      this.isGroupOwner = true;

      // Start local HTTP server for peer coordination
      await this.startPeerServer(port);

      console.log(`[WiFiDirect] Group Owner started: ${ssid}`);
      return this.config;
    } catch (error) {
      console.error('[WiFiDirect] Failed to start Group Owner:', error);
      return null;
    }
  }

  /**
   * Connect to an existing Wi-Fi Direct Group
   */
  async joinGroup(ssid: string, password: string, groupOwnerIP: string, deviceId: string, deviceName: string): Promise<boolean> {
    try {
      console.log(`[WiFiDirect] Attempting to join group: ${ssid}`);

      // In a real native app, this would use Android's Wi-Fi Direct APIs
      // For now, we'll simulate successful connection
      this.config = {
        ssid,
        password,
        port: 9000,
        groupOwnerIPv4: groupOwnerIP,
      };

      this.isGroupOwner = false;

      // Register with Group Owner
      await this.registerWithGroupOwner(groupOwnerIP, deviceId, deviceName);

      console.log(`[WiFiDirect] Joined group: ${ssid}`);
      return true;
    } catch (error) {
      console.error('[WiFiDirect] Failed to join group:', error);
      return false;
    }
  }

  private async startPeerServer(port: number) {
    // In a web environment, we can't create a real server
    // In a native Capacitor app, this would be implemented with native networking
    console.log(`[WiFiDirect] Peer server would listen on port ${port}`);
  }

  private async registerWithGroupOwner(groupOwnerIP: string, deviceId: string, deviceName: string) {
    try {
      const response = await fetch(`http://${groupOwnerIP}:9000/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: deviceId,
          peerName: deviceName,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.config!.groupOwnerIPv4 = data.assignedIPv4 || this.config!.groupOwnerIPv4;
        console.log(`[WiFiDirect] Registered with Group Owner`);
      }
    } catch (error) {
      console.warn('[WiFiDirect] Failed to register with Group Owner:', error);
    }
  }

  onPeersDiscovered(callback: (peers: WiFiDirectPeer[]) => void) {
    this.peerCallbacks.push(callback);
    return () => {
      this.peerCallbacks = this.peerCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyPeersDiscovered() {
    const peers = Array.from(this.connectedPeers.values());
    this.peerCallbacks.forEach((cb) => cb(peers));
  }

  addPeer(peerId: string, peerName: string, ipv4Address: string): void {
    const peer: WiFiDirectPeer = {
      peerId,
      peerName,
      ipv4Address,
      connectTime: Date.now(),
    };
    this.connectedPeers.set(peerId, peer);
    this.notifyPeersDiscovered();
  }

  removePeer(peerId: string): void {
    this.connectedPeers.delete(peerId);
    this.notifyPeersDiscovered();
  }

  getPeers(): WiFiDirectPeer[] {
    return Array.from(this.connectedPeers.values());
  }

  getConfig(): WiFiDirectConfig | null {
    return this.config;
  }

  isGroupOwnerMode(): boolean {
    return this.isGroupOwner;
  }

  async stopGroupOwner(): Promise<void> {
    console.log('[WiFiDirect] Stopping Group Owner');
    this.isGroupOwner = false;
    this.config = null;
    this.connectedPeers.clear();
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

export const wiFiDirectEngine = new WiFiDirectEngine();
