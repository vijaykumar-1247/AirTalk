import { House, LogOut, Radar, Settings as SettingsIcon, UserCheck } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppearanceSection from "@/components/settings/AppearanceSection";
import NetworkSection from "@/components/settings/NetworkSection";
import PermissionsSection from "@/components/settings/PermissionsSection";
import ProfileSection from "@/components/settings/ProfileSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSparkMesh } from "@/context/SparkMeshContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  applyAppearanceSettings,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type AccentPreset,
  type AppearanceSettings,
  type WallpaperPreset,
  type WallpaperTarget,
} from "@/lib/appearance-settings";
import { useAppLanguage } from "@/lib/i18n";
import { clearSavedOnlineCredentials, saveOnlineCredentialsForAutoFill } from "@/lib/local-auth-profile";

const makeLoginEmail = (uniqueId: string) => `${uniqueId.trim().toLowerCase()}@airtalk.local`;

const Settings = () => {
  const navigate = useNavigate();
  const { profile, updateProfile, disconnectFromNetwork, appMode, currentPing } = useSparkMesh();
  const { isLowDataModeEnabled, setLowDataModeEnabled } = useAppSettings();
  const { t } = useAppLanguage();
  const contentScrollRef = useRef<HTMLElement | null>(null);

  const [autoScan, setAutoScan] = useState(true);
  const [editedName, setEditedName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [editedUniqueId, setEditedUniqueId] = useState("");
  const [uniqueIdPassword, setUniqueIdPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [hasOnlineSession, setHasOnlineSession] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => loadAppearanceSettings());

  useEffect(() => {
    setEditedName(profile?.name ?? "");
    setEditedUniqueId(profile?.uniqueId ?? "");
    setAvatarPreview(profile?.avatarUrl ?? null);
    setUniqueIdPassword("");
  }, [profile?.avatarUrl, profile?.name, profile?.uniqueId]);

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasOnlineSession(Boolean(session?.user));
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasOnlineSession(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const scrollToTop = () => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAvatarPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSaveProfile = async () => {
    const safeName = editedName.trim();
    const safeUniqueId = editedUniqueId.trim().toLowerCase();

    if (!safeName || !safeUniqueId || isSaving) return;

    const currentUniqueId = profile?.uniqueId?.trim().toLowerCase() ?? "";
    const isUniqueIdChanged = safeUniqueId !== currentUniqueId;

    if (appMode === "online" && isUniqueIdChanged) {
      const safePassword = uniqueIdPassword.trim();
      if (!safePassword) {
        toast({
          title: "Password required",
          description: "Enter your current password to change unique ID.",
          variant: "destructive",
        });
        return;
      }

      if (!currentUniqueId) {
        toast({
          title: "Unique ID missing",
          description: "Please login again before changing unique ID.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: makeLoginEmail(currentUniqueId),
        password: safePassword,
      });

      if (error || !data.user) {
        toast({
          title: "Wrong password",
          description: "Current password is required to change unique ID.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSaving(true);
    const saved = await updateProfile(safeName, avatarPreview ?? undefined, safeUniqueId);
    setIsSaving(false);

    if (!saved) {
      toast({
        title: "Could not update profile",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setUniqueIdPassword("");
    toast({
      title: "Profile updated",
      description: "Name, photo and unique ID are saved.",
    });
  };

  const handleDisconnect = (saveOnlineInfo: boolean) => {
    if (saveOnlineInfo && appMode === "online") {
      const saved = saveOnlineCredentialsForAutoFill();
      if (!saved) {
        toast({
          title: "Login info not saved",
          description: "Login once in online mode before saving autofill data.",
          variant: "destructive",
        });
      }
    }

    if (!saveOnlineInfo) {
      clearSavedOnlineCredentials();
    }

    disconnectFromNetwork();
    setShowDisconnectDialog(false);
    navigate("/", { replace: true });
  };

  const handlePickWallpaper = (event: ChangeEvent<HTMLInputElement>, target: WallpaperTarget) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;

      setAppearance((prev) =>
        target === "appShell"
          ? { ...prev, appWallpaperCustomUrl: dataUrl }
          : { ...prev, chatWallpaperCustomUrl: dataUrl }
      );
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSaveAppearance = (target: "language" | "darkMode" | "wallpaper" | "accent") => {
    if (isSavingAppearance) return;
    setIsSavingAppearance(true);

    saveAppearanceSettings(appearance);
    applyAppearanceSettings(appearance);

    const successMessage: Record<typeof target, string> = {
      language: "Language saved.",
      darkMode: "Dark mode saved.",
      wallpaper: "Wallpaper saved.",
      accent: "Button color saved.",
    };

    toast({
      title: "Saved",
      description: successMessage[target],
    });

    setIsSavingAppearance(false);
  };

  const needsUniqueIdPassword = appMode === "online" && editedUniqueId.trim().toLowerCase() !== (profile?.uniqueId ?? "").trim().toLowerCase();
  const shouldShowUpgradeButton = appMode === "offline" && !hasOnlineSession;

  return (
    <>
      <main className="app-wallpaper-bg mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground shadow-card">
          <div>
            <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
            <p className="text-xs text-primary-foreground/80">{t("settings.subtitle")}</p>
          </div>
        </header>

        <section className="flex-1 space-y-4 overflow-y-auto p-4 pb-28" ref={contentScrollRef}>
          <ProfileSection
            avatarPreview={avatarPreview}
            deviceId={profile?.deviceId ?? "------"}
            editedName={editedName}
            editedUniqueId={editedUniqueId}
            isSaving={isSaving}
            needsUniqueIdPassword={needsUniqueIdPassword}
            onAvatarPick={handleAvatarPick}
            onConnectOnline={shouldShowUpgradeButton ? () => navigate("/upgrade-online") : undefined}
            onConnectOnlineLabel="Upgrade to Online Air Talk"
            onNameChange={setEditedName}
            onSave={() => void handleSaveProfile()}
            onUniqueIdChange={setEditedUniqueId}
            onUniqueIdPasswordChange={setUniqueIdPassword}
            uniqueIdPassword={uniqueIdPassword}
          />

          <NetworkSection
            autoScan={autoScan}
            currentPing={currentPing}
            lowDataMode={isLowDataModeEnabled}
            onAutoScanChange={setAutoScan}
            onLowDataModeChange={setLowDataModeEnabled}
          />

          <PermissionsSection />

          <AppearanceSection
            appearance={appearance}
            isSavingAppearance={isSavingAppearance}
            onDarkModeChange={(value) => setAppearance((prev) => ({ ...prev, darkMode: value }))}
            onPickWallpaper={handlePickWallpaper}
            onSave={handleSaveAppearance}
            onSelectAccent={(value: AccentPreset) => setAppearance((prev) => ({ ...prev, accent: value }))}
            onSelectWallpaper={(target: WallpaperTarget, value: WallpaperPreset) =>
              setAppearance((prev) =>
                target === "appShell"
                  ? { ...prev, appWallpaperPreset: value, appWallpaperCustomUrl: null }
                  : { ...prev, chatWallpaperPreset: value, chatWallpaperCustomUrl: null }
              )
            }
          />


          <Button className="w-full gap-2" onClick={() => navigate("/settings/unblock-list")} variant="outline">
            <UserCheck className="h-4 w-4" />
            {t("settings.unblockListAction")}
          </Button>

          <Button className="w-full gap-2" onClick={() => setShowDisconnectDialog(true)} variant="destructive">
            <LogOut className="h-4 w-4" />
            {t("settings.disconnect")}
          </Button>
        </section>

        <div className="pointer-events-none fixed inset-x-0 bottom-0">
          <div className="pointer-events-auto mx-auto grid w-full max-w-md grid-cols-3 gap-2 border-t border-border bg-card px-3 py-2">
            <Button
              className="active:scale-95 transition-transform dark:text-foreground"
              onClick={() => navigate("/home")}
              size="sm"
              variant="secondary"
            >
              <House className="h-4 w-4" />
              {t("common.home")}
            </Button>
            <Button
              className="active:scale-95 transition-transform dark:text-foreground"
              onClick={() => navigate("/scan")}
              size="sm"
              variant="secondary"
            >
              <Radar className="h-4 w-4" />
              {t("common.scan")}
            </Button>
            <Button
              className="active:scale-95 transition-transform dark:text-primary-foreground dark:ring-1 dark:ring-accent/60 dark:shadow-[0_0_12px_hsl(var(--accent)/0.35)]"
              onClick={scrollToTop}
              size="sm"
              variant="default"
            >
              <SettingsIcon className="h-4 w-4" />
              {t("common.settings")}
            </Button>
          </div>
        </div>
      </main>

      <Dialog onOpenChange={setShowDisconnectDialog} open={showDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.disconnectTitle")}</DialogTitle>
            <DialogDescription>
              {appMode === "online"
                ? t("settings.disconnectOnline")
                : t("settings.disconnectOffline")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => handleDisconnect(false)} variant="outline">
              {appMode === "online" ? t("settings.logoutOnly") : t("common.cancel")}
            </Button>
            <Button onClick={() => handleDisconnect(appMode === "online")} variant="destructive">
              {appMode === "online" ? t("settings.saveLogout") : t("settings.disconnectOnly")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Settings;
