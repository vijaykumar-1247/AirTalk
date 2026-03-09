import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AppSettingsContextValue = {
  isLowDataModeEnabled: boolean;
  setLowDataModeEnabled: (enabled: boolean) => void;
};

const APP_SETTINGS_KEY = "airtalk_app_settings";

const loadLowDataMode = () => {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { isLowDataModeEnabled?: boolean };
    return Boolean(parsed.isLowDataModeEnabled);
  } catch {
    return false;
  }
};

const persistLowDataMode = (enabled: boolean) => {
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify({ isLowDataModeEnabled: enabled }));
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [isLowDataModeEnabled, setIsLowDataModeEnabledState] = useState<boolean>(() => loadLowDataMode());

  const setLowDataModeEnabled = (enabled: boolean) => {
    setIsLowDataModeEnabledState(enabled);
    persistLowDataMode(enabled);
  };

  const value = useMemo(
    () => ({
      isLowDataModeEnabled,
      setLowDataModeEnabled,
    }),
    [isLowDataModeEnabled]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }
  return context;
};
