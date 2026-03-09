import { ArrowLeft, ChevronRight, MoonStar, Palette, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  type AccentPreset,
  type AppearanceSettings,
  type WallpaperPreset,
  type WallpaperTarget,
  wallpaperTemplates,
} from "@/lib/appearance-settings";
import { useAppLanguage } from "@/lib/i18n";

const wallpaperOptions: Array<{ id: WallpaperPreset; label: string }> = [
  { id: "none", label: "None" },
  { id: "mesh", label: "Mesh" },
  { id: "aurora", label: "Aurora" },
  { id: "sunset", label: "Sunset" },
];

const accentOptions: Array<{ id: AccentPreset; label: string; toneClass: string }> = [
  { id: "green", label: "Green", toneClass: "bg-accent" },
  { id: "blue", label: "Blue", toneClass: "bg-signal-stable" },
  { id: "red", label: "Red", toneClass: "bg-destructive" },
];

type AppearanceSaveTarget = "language" | "darkMode" | "wallpaper" | "accent";
type AppearanceView = "menu" | "wallpaper-menu" | "wallpaper-app" | "wallpaper-chat" | "accent";

type AppearanceSectionProps = {
  appearance: AppearanceSettings;
  isSavingAppearance: boolean;
  onDarkModeChange: (value: boolean) => void;
  onPickWallpaper: (event: ChangeEvent<HTMLInputElement>, target: WallpaperTarget) => void;
  onSave: (target: AppearanceSaveTarget) => void;
  onSelectAccent: (value: AccentPreset) => void;
  onSelectWallpaper: (target: WallpaperTarget, value: WallpaperPreset) => void;
};

const getWallpaperImage = (customUrl: string | null, preset: WallpaperPreset) => {
  if (customUrl) {
    return `url("${customUrl.replace(/"/g, '\\"')}")`;
  }

  if (preset === "none") return "none";
  return wallpaperTemplates[preset];
};

const AppearanceSection = ({
  appearance,
  isSavingAppearance,
  onDarkModeChange,
  onPickWallpaper,
  onSave,
  onSelectAccent,
  onSelectWallpaper,
}: AppearanceSectionProps) => {
  const { t } = useAppLanguage();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AppearanceView>("menu");

  useEffect(() => {
    if (!open) setView("menu");
  }, [open]);

  const appWallpaperImage = getWallpaperImage(appearance.appWallpaperCustomUrl, appearance.appWallpaperPreset);
  const chatWallpaperImage = getWallpaperImage(appearance.chatWallpaperCustomUrl, appearance.chatWallpaperPreset);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-accent">
          <Palette className="h-4 w-4" />
          {t("appearance.title")}
        </CardTitle>
        <CardDescription>{t("appearance.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t("appearance.help")}</p>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full justify-between" type="button" variant="outline">
              <span>{t("appearance.infoButton")}</span>
              <span className="text-xs text-muted-foreground">{t("appearance.open")}</span>
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            {view === "menu" ? (
              <>
                <DialogHeader>
                  <DialogTitle>{t("appearance.title")}</DialogTitle>
                  <DialogDescription>{t("appearance.dialogDescription")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-3 rounded-lg border border-border px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MoonStar className="h-4 w-4" />
                        <Label className="text-sm font-medium">Dark Mode</Label>
                      </div>
                      <span className="text-xs text-muted-foreground">{appearance.darkMode ? "ON" : "OFF"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => onDarkModeChange(true)} type="button" variant={appearance.darkMode ? "default" : "outline"}>
                        ON
                      </Button>
                      <Button onClick={() => onDarkModeChange(false)} type="button" variant={!appearance.darkMode ? "default" : "outline"}>
                        OFF
                      </Button>
                    </div>
                    <Button className="w-full" disabled={isSavingAppearance} onClick={() => onSave("darkMode")} type="button">
                      {t("common.save")}
                    </Button>
                  </div>

                  <Button className="w-full justify-between" onClick={() => setView("wallpaper-menu")} type="button" variant="outline">
                    <span>Wallpaper Settings</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  <Button className="w-full justify-between" onClick={() => setView("accent")} type="button" variant="outline">
                    <span>App Button Color</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : null}

            {view === "wallpaper-menu" ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <Button className="h-8 w-8" onClick={() => setView("menu")} size="icon" type="button" variant="ghost">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-sm font-semibold">Wallpaper Settings</h3>
                </div>

                <div className="space-y-3">
                  <Button className="w-full justify-between" onClick={() => setView("wallpaper-app")} type="button" variant="outline">
                    <span>App Wallpaper</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button className="w-full justify-between" onClick={() => setView("wallpaper-chat")} type="button" variant="outline">
                    <span>Chat Box Wallpaper</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : null}

            {view === "wallpaper-app" ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <Button className="h-8 w-8" onClick={() => setView("wallpaper-menu")} size="icon" type="button" variant="ghost">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-sm font-semibold">App Wallpaper</h3>
                </div>

                <div className="space-y-3">
                  <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <Upload className="h-4 w-4" />
                    {t("appearance.uploadWallpaper")}
                    <input accept="image/*" className="hidden" onChange={(event) => onPickWallpaper(event, "appShell")} type="file" />
                  </label>

                  <RadioGroup onValueChange={(value) => onSelectWallpaper("appShell", value as WallpaperPreset)} value={appearance.appWallpaperPreset}>
                    {wallpaperOptions.map((option) => (
                      <label className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 data-[state=checked]:border-ring" key={`app-${option.id}`}>
                        <span className="text-sm">{option.label}</span>
                        <RadioGroupItem value={option.id} />
                      </label>
                    ))}
                  </RadioGroup>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Wallpaper preview</Label>
                    <div className="h-24 w-full rounded-md border border-border bg-background" style={{ backgroundImage: appWallpaperImage, backgroundPosition: "center", backgroundSize: "cover" }} />
                  </div>

                  <Button className="w-full" disabled={isSavingAppearance} onClick={() => onSave("wallpaper")} type="button">
                    {t("common.save")}
                  </Button>
                </div>
              </>
            ) : null}

            {view === "wallpaper-chat" ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <Button className="h-8 w-8" onClick={() => setView("wallpaper-menu")} size="icon" type="button" variant="ghost">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-sm font-semibold">Chat Box Wallpaper</h3>
                </div>

                <div className="space-y-3">
                  <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <Upload className="h-4 w-4" />
                    {t("appearance.uploadWallpaper")}
                    <input accept="image/*" className="hidden" onChange={(event) => onPickWallpaper(event, "chat")} type="file" />
                  </label>

                  <RadioGroup onValueChange={(value) => onSelectWallpaper("chat", value as WallpaperPreset)} value={appearance.chatWallpaperPreset}>
                    {wallpaperOptions.map((option) => (
                      <label className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 data-[state=checked]:border-ring" key={`chat-${option.id}`}>
                        <span className="text-sm">{option.label}</span>
                        <RadioGroupItem value={option.id} />
                      </label>
                    ))}
                  </RadioGroup>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Wallpaper preview</Label>
                    <div className="h-24 w-full rounded-md border border-border bg-background" style={{ backgroundImage: chatWallpaperImage, backgroundPosition: "center", backgroundSize: "cover" }} />
                  </div>

                  <Button className="w-full" disabled={isSavingAppearance} onClick={() => onSave("wallpaper")} type="button">
                    {t("common.save")}
                  </Button>
                </div>
              </>
            ) : null}

            {view === "accent" ? (
              <>
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Button className="h-8 w-8" onClick={() => setView("menu")} size="icon" type="button" variant="ghost">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-sm font-semibold">App Button Color</h3>
                </div>

                <div className="space-y-3">
                  <RadioGroup onValueChange={(value) => onSelectAccent(value as AccentPreset)} value={appearance.accent}>
                    {accentOptions.map((option) => (
                      <label className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2" key={option.id}>
                        <span className="flex items-center gap-2 text-sm">
                          <span className={`h-2.5 w-2.5 rounded-full ${option.toneClass}`} />
                          {option.label}
                        </span>
                        <RadioGroupItem value={option.id} />
                      </label>
                    ))}
                  </RadioGroup>

                  <Button className="w-full" disabled={isSavingAppearance} onClick={() => onSave("accent")} type="button">
                    {t("common.save")}
                  </Button>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AppearanceSection;
