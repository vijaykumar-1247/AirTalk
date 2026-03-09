import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "com.airtalk.app",
  appName: "Air Talk",
  webDir: "dist",
  bundledWebRuntime: false,
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: "Scanning for AirTalk devices...",
        cancel: "Cancel",
        available: "Available",
        unavailable: "Unavailable",
        scanningFinished: "Scan finished",
      },
    },
    Zeroconf: {},
  },
};

export default config;
