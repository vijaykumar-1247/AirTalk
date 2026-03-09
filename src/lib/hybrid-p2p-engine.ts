/**
 * Hybrid P2P Engine - Orchestrates all phases of P2P connectivity
 * Phase 1: BLE Discovery
 * Phase 2: Credential Handshake
 * Phase 3: Wi-Fi Direct Long-range connectivity
 * Phase 4: Local Messaging
 */

import { bluetoothDiscoveryService, type SparkMeshUser } from '@/lib/bluetooth-discovery';
import { localMessagingEngine, type LocalPeerConnection, type LocalMessage } from '@/lib/local-messaging';
import { wiFiDirectEngine, type WiFiDirectPeer } from '@/lib/wifi-direct-engine';
import {
  encodeCredentialPayload,
  decodeCredentialPayload,
  generateWiFiDirectSSID,
  generateWiFiDirectPassword,
  type BLEConnectionPayload,
} from '@/lib/ble-handshake';

export interface OfflinePeerState {
  peerId: string;
  peerName: string;
  phase: 'ble-discovered' | 'connection-requested' | 'credentials-received' | 'wifi-connected' | 'messaging-ready';
  bleSignalStrength?: number;
  bleDistance?: number;
  wifiIPv4?: string;
  lastUpdated: number;
}

class HybridP2PEngine {
  private peerStates = new Map<string, OfflinePeerState>();
  private stateCallbacks: ((states: OfflinePeerState[]) => void)[] = [];
  private localWiFiConfig: { ssid: string; password: string } | null = null;
  private isAdvertising = false;
  private messageListeners: ((peerId: string, msg: LocalMessage) => void)[] = [];

  /**
   * Phase 1: Start BLE discovery and advertising
   */
  async startBLEDiscovery(localUserId: string, localUserName: string): Promise<void> {
    try {
      console.log('[HybridP2P] Starting BLE Phase 1 Discovery');

      const initialized = await bluetoothDiscoveryService.initialize();
      if (!initialized) {
        console.error('[HybridP2P] Failed to initialize Bluetooth');
        return;
      }

      // Start advertising this device
      await bluetoothDiscoveryService.startAdvertising(localUserName);
      this.isAdvertising = true;

      // Start scanning for peers
      const peers = await bluetoothDiscoveryService.startDiscovery(10000);
      
      // Update peer states based on discovered BLE devices
      peers.forEach((peer) => {
        const peerState: OfflinePeerState = {
          peerId: peer.id,
          peerName: peer.name,
          phase: 'ble-discovered',
          bleSignalStrength: peer.signalStrength,
          bleDistance: peer.rangeMeters,
          lastUpdated: Date.now(),
        };
        this.peerStates.set(peer.id, peerState);
      });

      this.notifyStateChange();
      console.log(`[HybridP2P] Discovered ${peers.length} BLE peers`);
    } catch (error) {
      console.error('[HybridP2P] BLE Discovery error:', error);
    }
  }

  /**
   * Phase 2: Send connection request with embedded credentials
   * User A taps User B on Radar → sends connection request with Wi-Fi credentials
   */
  async initializeConnectionRequest(
    targetPeerId: string,
    targetPeerName: string,
    localUserId: string,
    localUserName: string,
    localDeviceId: string
  ): Promise<boolean> {
    try {
      console.log(`[HybridP2P] Phase 2: Initiating connection to ${targetPeerName}`);

      // Step 1: Start local Wi-Fi Direct Group (if not already running)
      if (!this.localWiFiConfig) {
        const wifiConfig = await wiFiDirectEngine.startGroupOwner(localDeviceId, localUserName, 9000);
        if (!wifiConfig) {
          throw new Error('Failed to start Wi-Fi Direct Group Owner');
        }
        this.localWiFiConfig = {
          ssid: wifiConfig.ssid,
          password: wifiConfig.password,
        };
      }

      // Step 2: Create credential payload with Wi-Fi SSID and password
      const credentialPayload: BLEConnectionPayload = {
        type: 'ConnectionRequest',
        senderId: localUserId,
        senderName: localUserName,
        senderDeviceId: localDeviceId,
        wifiSSID: this.localWiFiConfig.ssid,
        wifiPassword: this.localWiFiConfig.password,
        wifiGroupOwnerIPv4: '192.168.49.1',
        timestamp: Date.now(),
      };

      // Step 3: Encode and simulate sending over BLE
      const encoded = encodeCredentialPayload(credentialPayload);
      console.log(`[HybridP2P] Credential payload encoded: ${encoded.substring(0, 50)}...`);

      // Step 4: Update peer state
      const peerState = this.peerStates.get(targetPeerId);
      if (peerState) {
        peerState.phase = 'connection-requested';
        peerState.lastUpdated = Date.now();
        this.notifyStateChange();
      }

      // In a real implementation, this would be sent over BLE
      // For now, we'll simulate reception after a delay
      this.simulateCredentialReception(targetPeerId, credentialPayload);

      return true;
    } catch (error) {
      console.error('[HybridP2P] Connection request error:', error);
      return false;
    }
  }

  private simulateCredentialReception(peerId: string, payload: BLEConnectionPayload) {
    setTimeout(() => {
      console.log(`[HybridP2P] Simulating credential reception from ${payload.senderName}`);
      // In a real app, BLE would trigger this event
      // For now, we manually update state
      const peerState = this.peerStates.get(peerId);
      if (peerState) {
        peerState.phase = 'credentials-received';
        peerState.lastUpdated = Date.now();
        this.notifyStateChange();
      }
    }, 1000);
  }

  /**
   * Phase 3: Accept connection and join Wi-Fi Direct Group
   * User B accepts request → automatically connects to User A's Wi-Fi network
   */
  async acceptConnectionRequest(
    peerId: string,
    wifiSSID: string,
    wifiPassword: string,
    groupOwnerIP: string,
    localDeviceId: string,
    localUserName: string
  ): Promise<boolean> {
    try {
      console.log(`[HybridP2P] Phase 3: Accepting connection from ${peerId}`);

      // Connect to the peer's Wi-Fi Direct group
      const joined = await wiFiDirectEngine.joinGroup(
        wifiSSID,
        wifiPassword,
        groupOwnerIP,
        localDeviceId,
        localUserName
      );

      if (!joined) {
        throw new Error('Failed to join Wi-Fi Direct group');
      }

      // Update peer state
      const peerState = this.peerStates.get(peerId);
      if (peerState) {
        peerState.phase = 'wifi-connected';
        peerState.wifiIPv4 = '192.168.49.2'; // Simulated IP
        peerState.lastUpdated = Date.now();
        this.notifyStateChange();
      }

      // Phase 4: Establish local messaging connection
      await this.establishLocalMessaging(peerId);

      return true;
    } catch (error) {
      console.error('[HybridP2P] Connection acceptance error:', error);
      return false;
    }
  }

  /**
   * Phase 4: Establish local WebSocket connection for instant messaging
   */
  private async establishLocalMessaging(peerId: string): Promise<void> {
    try {
      const peerState = this.peerStates.get(peerId);
      if (!peerState || !peerState.wifiIPv4) {
        throw new Error('Peer state not ready for messaging');
      }

      console.log(`[HybridP2P] Establishing local messaging to ${peerId}`);

      const config = wiFiDirectEngine.getConfig();
      if (!config) {
        throw new Error('Wi-Fi Direct config not available');
      }

      // Connect via local WebSocket
      const connected = await localMessagingEngine.connectTo(
        peerId,
        peerState.wifiIPv4,
        config.groupOwnerIPv4,
        peerState.peerName
      );

      if (connected) {
        peerState.phase = 'messaging-ready';
        peerState.lastUpdated = Date.now();
        this.notifyStateChange();

        // Set up message listener
        this.setupMessageListener(peerId);

        console.log(`[HybridP2P] Local messaging ready for ${peerId}`);
      }
    } catch (error) {
      console.error('[HybridP2P] Local messaging error:', error);
    }
  }

  private setupMessageListener(peerId: string) {
    localMessagingEngine.onMessage((msg, msgPeerId) => {
      if (msgPeerId === peerId) {
        this.messageListeners.forEach((listener) => listener(peerId, msg));
      }
    });

    localMessagingEngine.onStatusChange((statusPeerId, status) => {
      if (statusPeerId === peerId && status === 'disconnected') {
        const peerState = this.peerStates.get(peerId);
        if (peerState) {
          peerState.phase = 'wifi-connected'; // Fall back to Wi-Fi only
          peerState.lastUpdated = Date.now();
          this.notifyStateChange();
        }
      }
    });
  }

  /**
   * Send a message to a connected peer
   */
  async sendMessage(peerId: string, text: string): Promise<boolean> {
    try {
      const connection = localMessagingEngine.getConnection(peerId);
      if (!connection || connection.status !== 'connected') {
        console.warn(`[HybridP2P] Peer ${peerId} not connected for messaging`);
        return false;
      }

      return await localMessagingEngine.sendMessage(peerId, {
        senderId: 'local-user', // Would be replaced with actual user ID
        senderName: 'You', // Would be replaced with actual user name
        text,
        type: 'text',
      });
    } catch (error) {
      console.error('[HybridP2P] Send message error:', error);
      return false;
    }
  }

  /**
   * Get all peer states (for UI updates)
   */
  getPeerStates(): OfflinePeerState[] {
    return Array.from(this.peerStates.values());
  }

  /**
   * Get peers ready for messaging
   */
  getActivePeers(): OfflinePeerState[] {
    return Array.from(this.peerStates.values()).filter(
      (state) => state.phase === 'messaging-ready'
    );
  }

  /**
   * Listen for peer state changes
   */
  onPeerStatesChanged(callback: (states: OfflinePeerState[]) => void) {
    this.stateCallbacks.push(callback);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Listen for incoming messages
   */
  onMessage(callback: (peerId: string, msg: LocalMessage) => void) {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyStateChange() {
    const states = this.getPeerStates();
    this.stateCallbacks.forEach((cb) => cb(states));
  }

  /**
   * Stop all connections and advertising
   */
  async stop(): Promise<void> {
    try {
      console.log('[HybridP2P] Stopping engine');

      if (this.isAdvertising) {
        await bluetoothDiscoveryService.stopAdvertising();
        this.isAdvertising = false;
      }

      await bluetoothDiscoveryService.stopDiscovery();
      await localMessagingEngine.disconnectAll();
      await wiFiDirectEngine.stopGroupOwner();

      this.peerStates.clear();
      this.localWiFiConfig = null;
    } catch (error) {
      console.error('[HybridP2P] Stop error:', error);
    }
  }
}

export const hybridP2PEngine = new HybridP2PEngine();
export type { OfflinePeerState };
