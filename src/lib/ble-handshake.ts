/**
 * BLE Handshake Protocol
 * Encodes/decodes Wi-Fi Direct credentials and peer metadata for BLE payload transmission
 */

export interface BLEConnectionPayload {
  type: 'ConnectionRequest' | 'ConnectionResponse';
  senderId: string;
  senderName: string;
  senderDeviceId: string;
  wifiSSID?: string;
  wifiPassword?: string;
  wifiGroupOwnerIPv4?: string;
  timestamp: number;
  signature?: string;
}

export interface BLEDiscoveredPeer {
  peerId: string;
  name: string;
  rssi: number;
  lastSeen: number;
  hasCredentials?: boolean;
}

/**
 * Encode credential payload into a string format suitable for BLE transmission
 * Format: type:senderId:senderName:senderDeviceId:wifiSSID:wifiPassword:ipv4:timestamp
 */
export const encodeCredentialPayload = (payload: BLEConnectionPayload): string => {
  const parts = [
    payload.type,
    encodeURIComponent(payload.senderId),
    encodeURIComponent(payload.senderName),
    encodeURIComponent(payload.senderDeviceId),
    payload.wifiSSID ? encodeURIComponent(payload.wifiSSID) : '',
    payload.wifiPassword ? encodeURIComponent(payload.wifiPassword) : '',
    payload.wifiGroupOwnerIPv4 || '',
    payload.timestamp,
  ];
  return parts.join('|');
};

/**
 * Decode credential payload from BLE string
 */
export const decodeCredentialPayload = (encoded: string): BLEConnectionPayload | null => {
  try {
    const parts = encoded.split('|');
    if (parts.length < 8) return null;

    return {
      type: parts[0] as 'ConnectionRequest' | 'ConnectionResponse',
      senderId: decodeURIComponent(parts[1]),
      senderName: decodeURIComponent(parts[2]),
      senderDeviceId: decodeURIComponent(parts[3]),
      wifiSSID: parts[4] ? decodeURIComponent(parts[4]) : undefined,
      wifiPassword: parts[5] ? decodeURIComponent(parts[5]) : undefined,
      wifiGroupOwnerIPv4: parts[6] || undefined,
      timestamp: parseInt(parts[7], 10),
    };
  } catch (error) {
    console.warn('Failed to decode credential payload:', error);
    return null;
  }
};

/**
 * Generate Wi-Fi Direct SSID from user credentials
 * Format: AT-{deviceIdLast6}-{randomSuffix}
 */
export const generateWiFiDirectSSID = (deviceId: string): string => {
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const deviceSuffix = deviceId.slice(-6).toUpperCase();
  return `AT-${deviceSuffix}-${suffix}`;
};

/**
 * Generate secure Wi-Fi Direct password (12-16 chars, alphanumeric + symbols)
 */
export const generateWiFiDirectPassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Calculate RSSI distance approximation (Bluetooth)
 * Based on TX power and RSSI measurements
 */
export const calculateBLEDistance = (rssi: number, txPower: number = -59): number => {
  if (rssi === 0) return -1;
  const ratio = (txPower - rssi) / 20.0;
  return Math.pow(10, ratio);
};

/**
 * Create a connection request advertisement string for BLE
 */
export const createConnectionRequestAdvertisement = (
  senderId: string,
  senderName: string,
  senderDeviceId: string
): string => {
  return `CONN_REQ:${encodeURIComponent(senderId)}:${encodeURIComponent(senderName)}:${senderDeviceId}`;
};

/**
 * Parse connection request from advertisement
 */
export const parseConnectionRequestAdvertisement = (
  advertisement: string
): { senderId: string; senderName: string; senderDeviceId: string } | null => {
  try {
    const parts = advertisement.split(':');
    if (parts.length !== 4 || parts[0] !== 'CONN_REQ') return null;

    return {
      senderId: decodeURIComponent(parts[1]),
      senderName: decodeURIComponent(parts[2]),
      senderDeviceId: parts[3],
    };
  } catch (error) {
    console.warn('Failed to parse connection request:', error);
    return null;
  }
};
