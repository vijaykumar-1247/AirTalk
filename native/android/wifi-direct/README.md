# Wi-Fi Direct Capacitor Plugin Scaffold (Android)

This folder contains a scaffold Android implementation for the Capacitor plugin name:

- `WifiDirectTransport`

## Next steps

1. Export/pull this project locally.
2. Run `npx cap add android` (if not already done).
3. Copy `WifiDirectTransportPlugin.java` into your Android app source tree under:
   - `android/app/src/main/java/<your/package>/WifiDirectTransportPlugin.java`
4. Register the plugin in your app's `MainActivity` if auto-registration does not pick it up:
   - `registerPlugin(WifiDirectTransportPlugin.class);`
5. Run:
   - `npm run build`
   - `npx cap sync android`

The web app is already wired to call this plugin through `src/lib/sparkmesh-backend.ts`.
