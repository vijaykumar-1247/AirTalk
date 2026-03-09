import { BleClient, type ScanResult } from '@capacitor-community/bluetooth-le';
import type { SparkMeshUser } from '@/types/sparkmesh';

const AIRTALK_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const AIRTALK_CHARACTERISTIC_UUID = '87654321-4321-4321-4321-cba987654321';

export interface AirTalkBluetoothDevice {
  deviceId: string;
  name: string;
  rssi: number;
  discoveredAt: number;
}

class BluetoothDiscoveryService {
  private isScanning = false;
  private isAdvertising = false;
  private discoveredDevices = new Map<string, AirTalkBluetoothDevice>();
  private scanTimeout: NodeJS.Timeout | null = null;

  async initialize(): Promise<boolean> {
    try {
      await BleClient.initialize();
      // Request permissions explicitly for Android
      await BleClient.requestPermissions();
      return true;
    } catch (error) {
      console.warn('Bluetooth LE initialization failed:', error);
      return false;
    }
  }

  async startAdvertising(deviceName: string): Promise<boolean> {
    if (this.isAdvertising) return true;

    try {
      // Create a simple service with a characteristic that broadcasts the device name
      await BleClient.createService({
        uuid: AIRTALK_SERVICE_UUID,
        characteristics: [
          {
            uuid: AIRTALK_CHARACTERISTIC_UUID,
            properties: {
              read: true,
              write: false,
              notify: false,
              indicate: false,
            },
            permissions: {
              read: true,
              write: false,
            },
          },
        ],
      });

      // Start advertising
      await BleClient.startAdvertising({
        uuid: AIRTALK_SERVICE_UUID,
        name: deviceName,
        manufacturerData: {
          // Include device name in manufacturer data for easier discovery
          0xFFFF: new TextEncoder().encode(deviceName).buffer,
        },
      });

      this.isAdvertising = true;
      return true;
    } catch (error) {
      console.warn('Bluetooth advertising failed:', error);
      return false;
    }
  }

  async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) return;

    try {
      await BleClient.stopAdvertising();
      this.isAdvertising = false;
    } catch (error) {
      console.warn('Failed to stop Bluetooth advertising:', error);
    }
  }

  async startDiscovery(durationMs: number = 10000): Promise<SparkMeshUser[]> {
    if (this.isScanning) {
      await this.stopDiscovery();
    }

    this.isScanning = true;
    this.discoveredDevices.clear();

    try {
      await BleClient.requestLEScan(
        {
          services: [AIRTALK_SERVICE_UUID],
          allowDuplicates: false,
        },
        (result: ScanResult) => {
          this.handleDeviceDiscovered(result);
        }
      );

      // Stop scanning after duration
      this.scanTimeout = setTimeout(() => {
        this.stopDiscovery();
      }, durationMs);

      // Wait for scan to complete
      return new Promise((resolve) => {
        const checkComplete = () => {
          if (!this.isScanning) {
            const devices = Array.from(this.discoveredDevices.values()).map(this.mapToSparkMeshUser);
            resolve(devices);
          } else {
            setTimeout(checkComplete, 500);
          }
        };
        setTimeout(checkComplete, durationMs + 500);
      });

    } catch (error) {
      console.warn('Bluetooth discovery failed:', error);
      this.isScanning = false;
      return [];
    }
  }

  async stopDiscovery(): Promise<void> {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    try {
      await BleClient.stopLEScan();
    } catch (error) {
      console.warn('Failed to stop Bluetooth scan:', error);
    }

    this.isScanning = false;
  }

  private handleDeviceDiscovered(result: ScanResult): void {
    if (!result.device?.deviceId) return;

    // Try to extract device name from manufacturer data or use default
    let deviceName = result.device.name || `AirTalk-${result.device.deviceId.slice(-6)}`;

    // Check manufacturer data for custom name
    if (result.manufacturerData && result.manufacturerData[0xFFFF]) {
      try {
        const nameBytes = new Uint8Array(result.manufacturerData[0xFFFF]);
        const decodedName = new TextDecoder().decode(nameBytes);
        if (decodedName) {
          deviceName = decodedName;
        }
      } catch (error) {
        console.warn('Failed to decode device name from manufacturer data:', error);
      }
    }

    const device: AirTalkBluetoothDevice = {
      deviceId: result.device.deviceId,
      name: deviceName,
      rssi: result.rssi || -50,
      discoveredAt: Date.now(),
    };

    this.discoveredDevices.set(result.device.deviceId, device);
  }

  private mapToSparkMeshUser(device: AirTalkBluetoothDevice): SparkMeshUser {
    // Calculate approximate distance based on RSSI
    const distance = this.calculateDistance(device.rssi);

    return {
      id: device.deviceId,
      name: device.name,
      deviceId: device.deviceId,
      avatarSeed: device.name.toLowerCase(),
      signalStrength: device.rssi,
      rangeMeters: distance,
      onlineStatus: true,
      lastSeen: new Date(device.discoveredAt).toISOString(),
      source: 'bluetooth',
    };
  }

  private calculateDistance(rssi: number): number {
    // Simple RSSI to distance approximation
    // This is a rough estimate and varies by device/environment
    const txPower = -59; // Measured power at 1 meter
    if (rssi === 0) return -1;

    const ratio = (txPower - rssi) / 20.0;
    return Math.pow(10, ratio);
  }

  getIsScanning(): boolean {
    return this.isScanning;
  }

  getIsAdvertising(): boolean {
    return this.isAdvertising;
  }

  getDiscoveredDeviceCount(): number {
    return this.discoveredDevices.size;
  }
}

export const bluetoothDiscoveryService = new BluetoothDiscoveryService();