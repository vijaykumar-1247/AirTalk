import { Capacitor } from "@capacitor/core";

const WEB_DEVICE_ID_KEY = "sparkmesh_web_device_id";
const NATIVE_DEVICE_ID_KEY = "sparkmesh_native_device_id";

const sanitize = (value: string) => value.replace(/[^A-Z0-9]/gi, "").toUpperCase();

const buildWebFingerprint = () => {
  const source = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    String(navigator.hardwareConcurrency ?? ""),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36).toUpperCase();
};

const createDeviceId = (prefix: string, suffix: string) => `${prefix}-${sanitize(suffix).slice(0, 12)}`;

export const getPlatformSyncedDeviceId = () => {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const existing = localStorage.getItem(NATIVE_DEVICE_ID_KEY);
    if (existing) return existing;

    const generated = createDeviceId("ANDROID", `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
    localStorage.setItem(NATIVE_DEVICE_ID_KEY, generated);
    return generated;
  }

  const existing = localStorage.getItem(WEB_DEVICE_ID_KEY);
  if (existing) return existing;

  const generated = createDeviceId("BROWSER", buildWebFingerprint());
  localStorage.setItem(WEB_DEVICE_ID_KEY, generated);
  return generated;
};
