import { defineConfig } from "@capacitor/cli";

export default defineConfig({
  appId: "app.lovable.8dcdbd5350824c2aa18147fbdf8fb57f",
  appName: "mesh-spark-comms",
  webDir: "dist",
  server: {
    url: "https://8dcdbd53-5082-4c2a-a181-47fbdf8fb57f.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
});
