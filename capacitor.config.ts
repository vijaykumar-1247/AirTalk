import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "com.airtalk.app",
  appName: "Air Talk",
  webDir: "dist",
  server: {
    url: "https://8dcdbd53-5082-4c2a-a181-47fbdf8fb57f.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
};

export default config;
