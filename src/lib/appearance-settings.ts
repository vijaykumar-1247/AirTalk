export type AccentPreset = "green" | "blue" | "red";
export type WallpaperPreset = "none" | "mesh" | "aurora" | "sunset";
export type WallpaperTarget = "appShell" | "chat";

export type AppearanceSettings = {
  accent: AccentPreset;
  darkMode: boolean;
  appWallpaperCustomUrl: string | null;
  appWallpaperPreset: WallpaperPreset;
  chatWallpaperCustomUrl: string | null;
  chatWallpaperPreset: WallpaperPreset;
};

export const APP_APPEARANCE_KEY = "sparkmesh_app_appearance";

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  accent: "green",
  darkMode: false,
  appWallpaperCustomUrl: null,
  appWallpaperPreset: "none",
  chatWallpaperCustomUrl: null,
  chatWallpaperPreset: "none",
};

const accentPalettes: Record<AccentPreset, { primary: string; ring: string }> = {
  green: { primary: "174 86% 20%", ring: "142 70% 49%" },
  blue: { primary: "213 87% 40%", ring: "210 100% 52%" },
  red: { primary: "0 74% 46%", ring: "0 80% 58%" },
};

export const wallpaperTemplates: Record<Exclude<WallpaperPreset, "none">, string> = {
  mesh:
    "radial-gradient(circle at 14% 22%, hsl(var(--primary) / 0.2) 0 24%, transparent 48%), radial-gradient(circle at 78% 14%, hsl(var(--accent) / 0.14) 0 20%, transparent 42%), linear-gradient(145deg, hsl(var(--background)), hsl(var(--muted) / 0.78))",
  aurora:
    "radial-gradient(circle at 24% 20%, hsl(173 70% 55% / 0.24) 0 28%, transparent 54%), radial-gradient(circle at 78% 18%, hsl(205 88% 62% / 0.2) 0 24%, transparent 52%), radial-gradient(circle at 52% 90%, hsl(146 65% 52% / 0.18) 0 24%, transparent 58%), linear-gradient(165deg, hsl(var(--background)), hsl(var(--muted) / 0.84))",
  sunset:
    "radial-gradient(circle at 16% 18%, hsl(20 95% 62% / 0.24) 0 26%, transparent 54%), radial-gradient(circle at 82% 26%, hsl(340 82% 60% / 0.2) 0 25%, transparent 56%), linear-gradient(160deg, hsl(var(--background)), hsl(var(--muted) / 0.9))",
};

const normalizeWallpaperPreset = (value: unknown): WallpaperPreset =>
  value === "mesh" || value === "aurora" || value === "sunset" ? value : "none";

export const loadAppearanceSettings = (): AppearanceSettings => {
  try {
    const raw = localStorage.getItem(APP_APPEARANCE_KEY);
    if (!raw) return DEFAULT_APPEARANCE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings> & {
      wallpaperCustomUrl?: string | null;
      wallpaperPreset?: WallpaperPreset;
    };

    const legacyWallpaperCustomUrl = parsed.wallpaperCustomUrl ?? null;
    const legacyWallpaperPreset = normalizeWallpaperPreset(parsed.wallpaperPreset);

    return {
      accent: parsed.accent === "blue" || parsed.accent === "red" || parsed.accent === "green" ? parsed.accent : "green",
      darkMode: Boolean(parsed.darkMode),
      appWallpaperCustomUrl: parsed.appWallpaperCustomUrl ?? legacyWallpaperCustomUrl,
      appWallpaperPreset: normalizeWallpaperPreset(parsed.appWallpaperPreset ?? legacyWallpaperPreset),
      chatWallpaperCustomUrl: parsed.chatWallpaperCustomUrl ?? legacyWallpaperCustomUrl,
      chatWallpaperPreset: normalizeWallpaperPreset(parsed.chatWallpaperPreset ?? legacyWallpaperPreset),
    };
  } catch {
    return DEFAULT_APPEARANCE_SETTINGS;
  }
};

export const saveAppearanceSettings = (settings: AppearanceSettings) => {
  localStorage.setItem(APP_APPEARANCE_KEY, JSON.stringify(settings));
};

const applyWallpaperTokens = (
  root: HTMLElement,
  cssPrefix: "app" | "chat",
  customUrl: string | null,
  preset: WallpaperPreset
) => {
  const imageVariable = `--${cssPrefix}-wallpaper-image`;
  const sizeVariable = `--${cssPrefix}-wallpaper-size`;
  const positionVariable = `--${cssPrefix}-wallpaper-position`;

  if (customUrl) {
    const safeUrl = customUrl.replace(/"/g, '\\"');
    root.style.setProperty(imageVariable, `url("${safeUrl}")`);
    root.style.setProperty(sizeVariable, "cover");
    root.style.setProperty(positionVariable, "center");
    return;
  }

  if (preset !== "none") {
    root.style.setProperty(imageVariable, wallpaperTemplates[preset]);
    root.style.setProperty(sizeVariable, "cover");
    root.style.setProperty(positionVariable, "center");
    return;
  }

  root.style.setProperty(imageVariable, "none");
  root.style.setProperty(sizeVariable, "cover");
  root.style.setProperty(positionVariable, "center");
};

export const applyAppearanceSettings = (settings: AppearanceSettings) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.toggle("dark", settings.darkMode);

  const palette = accentPalettes[settings.accent];
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--secondary-foreground", palette.primary);
  root.style.setProperty("--ring", palette.ring);

  applyWallpaperTokens(root, "app", settings.appWallpaperCustomUrl, settings.appWallpaperPreset);
  applyWallpaperTokens(root, "chat", settings.chatWallpaperCustomUrl, settings.chatWallpaperPreset);
};
