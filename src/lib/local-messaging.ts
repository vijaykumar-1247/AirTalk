/**
 * Local Messaging Engine
 * Handles WebSocket / Raw TCP/UDP connections over local IP subnet
 * Communicates with peers on the local Wi-Fi network
 */

export interface LocalMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  timestamp: number;
  type: 'text' | 'attachment' | 'typing' | 'delivered' | 'read';
}

export interface LocalPeerConnection {
  peerId: string;
  peerIPv4: string;
  peerName: string;
  localIPv4: string;
  status: 'connecting' | 'connected' | 'disconnected';
  lastMessageTime?: number;
  messageBuffer: LocalMessage[];
}

class LocalMessagingEngine {
  private connections = new Map<string, LocalPeerConnection>();
  private websockets = new Map<string, WebSocket>();
  private messageCallbacks: ((msg: LocalMessage, peerId: string) => void)[] = [];
  private statusCallbacks: ((peerId: string, status: string) => void)[] = [];

  async connectTo(peerId: string, peerIPv4: string, localIPv4: string, peerName: string): Promise<boolean> {
    try {
      const wsUrl = `ws://${peerIPv4}:9000`;
      console.log(`[LocalMessaging] Connecting to peer ${peerId} at ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`[LocalMessaging] Connection timeout for ${peerId}`);
          ws.close();
          resolve(false);
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          console.log(`[LocalMessaging] Connected to ${peerId}`);

          // Send handshake
          this.sendHandshake(ws, peerId);

          const connection: LocalPeerConnection = {
            peerId,
            peerIPv4,
            peerName,
            localIPv4,
            status: 'connected',
            messageBuffer: [],
          };

          this.connections.set(peerId, connection);
          this.websockets.set(peerId, ws);
          this.notifyStatusChange(peerId, 'connected');
          resolve(true);
        };

        ws.onmessage = (event) => {
          this.handleMessage(peerId, event.data);
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error(`[LocalMessaging] WebSocket error for ${peerId}:`, error);
          resolve(false);
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          console.log(`[LocalMessaging] Disconnected from ${peerId}`);
          this.websockets.delete(peerId);
          this.connections.delete(peerId);
          this.notifyStatusChange(peerId, 'disconnected');
        };
      });
    } catch (error) {
      console.error(`[LocalMessaging] Connection error for ${peerId}:`, error);
      return false;
    }
  }

  private sendHandshake(ws: WebSocket, peerId: string) {
    const handshake = {
      type: 'handshake',
      peerId,
      timestamp: Date.now(),
    };
    try {
      ws.send(JSON.stringify(handshake));
    } catch (error) {
      console.warn('Failed to send handshake:', error);
    }
  }

  private handleMessage(peerId: string, rawData: string | ArrayBuffer) {
    try {
      const data = typeof rawData === 'string' ? rawData : new TextDecoder().decode(rawData);
      const message = JSON.parse(data) as LocalMessage | { type: string };

      if (message.type === 'handshake') {
        console.log(`[LocalMessaging] Handshake received from ${peerId}`);
        return;
      }

      if ('senderId' in message) {
        const localMsg = message as LocalMessage;
        const connection = this.connections.get(peerId);
        if (connection) {
          connection.lastMessageTime = localMsg.timestamp;
          connection.messageBuffer.push(localMsg);
        }
        this.messageCallbacks.forEach((cb) => cb(localMsg, peerId));
      }
    } catch (error) {
      console.warn(`[LocalMessaging] Failed to parse message from ${peerId}:`, error);
    }
  }

  async sendMessage(
    peerId: string,
    message: Omit<LocalMessage, 'id' | 'timestamp'>
  ): Promise<boolean> {
    try {
      const ws = this.websockets.get(peerId);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn(`[LocalMessaging] WebSocket not ready for ${peerId}`);
        return false;
      }

      const fullMessage: LocalMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      ws.send(JSON.stringify(fullMessage));
      console.log(`[LocalMessaging] Message sent to ${peerId}`);
      return true;
    } catch (error) {
      console.error(`[LocalMessaging] Error sending message to ${peerId}:`, error);
      return false;
    }
  }

  onMessage(callback: (msg: LocalMessage, peerId: string) => void) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }

  onStatusChange(callback: (peerId: string, status: string) => void) {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyStatusChange(peerId: string, status: string) {
    this.statusCallbacks.forEach((cb) => cb(peerId, status));
  }

  getConnection(peerId: string): LocalPeerConnection | undefined {
    return this.connections.get(peerId);
  }

  getAllConnections(): LocalPeerConnection[] {
    return Array.from(this.connections.values());
  }

  async disconnectFrom(peerId: string): Promise<void> {
    const ws = this.websockets.get(peerId);
    if (ws) {
      ws.close();
    }
    this.websockets.delete(peerId);
    this.connections.delete(peerId);
    this.notifyStatusChange(peerId, 'disconnected');
  }

  async disconnectAll(): Promise<void> {
    for (const [peerId] of this.websockets) {
      await this.disconnectFrom(peerId);
    }
  }

  getBufferedMessages(peerId: string): LocalMessage[] {
    const connection = this.connections.get(peerId);
    return connection?.messageBuffer || [];
  }

  clearBufferedMessages(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.messageBuffer = [];
    }
  }
}

export const localMessagingEngine = new LocalMessagingEngine();
