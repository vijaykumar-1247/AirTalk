export type PermissionState = "idle" | "requesting" | "granted" | "denied";

export type PermissionStatusMap = {
  bluetoothLocation: PermissionState;
  localStorage: PermissionState;
  media: PermissionState;
  notifications: PermissionState;
};

export const PERMISSION_STATUS_KEY = "sparkmesh_permission_statuses";

export const DEFAULT_PERMISSION_STATUSES: PermissionStatusMap = {
  bluetoothLocation: "idle",
  localStorage: "idle",
  media: "idle",
  notifications: "idle",
};

export const permissionLabels: Record<keyof PermissionStatusMap, string> = {
  bluetoothLocation: "Bluetooth & Location",
  localStorage: "Local Storage",
  media: "Microphone & Camera",
  notifications: "Notifications",
};

export const loadPermissionStatuses = (): PermissionStatusMap => {
  try {
    const raw = localStorage.getItem(PERMISSION_STATUS_KEY);
    if (!raw) return DEFAULT_PERMISSION_STATUSES;
    const parsed = JSON.parse(raw) as Partial<PermissionStatusMap>;
    return {
      bluetoothLocation: parsed.bluetoothLocation ?? "idle",
      localStorage: parsed.localStorage ?? "idle",
      media: parsed.media ?? "idle",
      notifications: parsed.notifications ?? "idle",
    };
  } catch {
    return DEFAULT_PERMISSION_STATUSES;
  }
};

export const savePermissionStatuses = (value: PermissionStatusMap) => {
  localStorage.setItem(PERMISSION_STATUS_KEY, JSON.stringify(value));
};

export const getMissingPermissions = (statuses: PermissionStatusMap) =>
  (Object.keys(statuses) as Array<keyof PermissionStatusMap>)
    .filter((key) => statuses[key] !== "granted")
    .map((key) => permissionLabels[key]);
