import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "com.airtalk.app",
  appName: "Air Talk",
  webDir: "dist",
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
    Zeroconf: {
      domain: "local",
    },
    App: {},
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav",
    },
  },
};

export default config;
