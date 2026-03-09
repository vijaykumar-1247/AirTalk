import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface WifiDirectPeer {
  peerId: string;
  deviceName: string;
  deviceAddress?: string;
  broadcastPayload?: string;
  signalStrength?: number;
  rangeMeters?: number;
  status?: "available" | "invited" | "connected" | "failed" | "unavailable";
}

export interface WifiDirectMessageEvent {
  fromPeerId: string;
  text?: string;
  attachmentBase64?: string;
  attachmentName?: string;
  mimeType?: string;
  receivedAt: string;
}

export interface WifiDirectTransportPlugin {
  startDiscovery(): Promise<{ ok: boolean }>;
  stopDiscovery(): Promise<{ ok: boolean }>;
  startAdvertising(options: { payload: string }): Promise<{ ok: boolean; payload: string }>;
  stopAdvertising(): Promise<{ ok: boolean }>;
  getDiscoveredPeers(): Promise<{ peers: WifiDirectPeer[] }>;
  connectToPeer(options: { peerId: string }): Promise<{ ok: boolean; peerId: string }>;
  connectKnownPeers(options: { peerIds: string[] }): Promise<{ ok: boolean; connectedPeerIds: string[] }>;
  disconnectPeer(options?: { peerId?: string }): Promise<{ ok: boolean; peerId?: string }>;
  sendMessage(options: {
    peerId: string;
    text?: string;
    attachmentBase64?: string;
    attachmentName?: string;
    mimeType?: string;
  }): Promise<{ ok: boolean; messageId: string }>;
  initiateCall(options: { peerId: string; mode: "voice" | "video" }): Promise<{ ok: boolean; peerId: string; mode: "voice" | "video" }>;
  endCall(): Promise<{ ok: boolean }>;
  setMute(options: { muted: boolean }): Promise<{ ok: boolean; muted: boolean }>;
  setSpeaker(options: { speakerOn: boolean }): Promise<{ ok: boolean; speakerOn: boolean }>;
  setVideo(options: { videoEnabled: boolean }): Promise<{ ok: boolean; videoEnabled: boolean }>;
  addListener(eventName: "peersUpdated", listenerFunc: (event: { peers: WifiDirectPeer[] }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "messageReceived", listenerFunc: (event: WifiDirectMessageEvent) => void): Promise<PluginListenerHandle>;
  addListener(
    eventName: "peerConnectionStateChanged",
    listenerFunc: (event: { peerId: string; status: "connected" | "disconnected" }) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const WifiDirectTransport = registerPlugin<WifiDirectTransportPlugin>("WifiDirectTransport");
