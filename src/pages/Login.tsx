import { ArrowLeft, Eye, EyeOff, Loader2, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ProfileAvatarBar from "@/components/sparkmesh/ProfileAvatarBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSparkMesh } from "@/context/SparkMeshContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAppLanguage } from "@/lib/i18n";
import { cacheOnlineCredentialsForLogout, loadSavedOnlineCredentials, saveLocalProfileSnapshot } from "@/lib/local-auth-profile";
import { getAvatarTemplateByIndex } from "@/lib/offline-p2p";

const makeLoginEmail = (uniqueId: string) => `${uniqueId.trim().toLowerCase()}@airtalk.local`;

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { connectToNetwork, connectOfflineProfile } = useSparkMesh();
  const { t } = useAppLanguage();

  const [authMethod, setAuthMethod] = useState<"online" | "offline">(searchParams.get("connect") === "offline" ? "offline" : "online");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingOnline, setIsSubmittingOnline] = useState(false);

  const [offlineName, setOfflineName] = useState("");
  const [offlineUniqueId, setOfflineUniqueId] = useState("");
  const [offlineAvatarIndex, setOfflineAvatarIndex] = useState(0);
  const [offlineAvatarPreview, setOfflineAvatarPreview] = useState<string | null>(null);
  const [isSubmittingOffline, setIsSubmittingOffline] = useState(false);

  useEffect(() => {
    const saved = loadSavedOnlineCredentials();
    if (!saved) return;

    setIdentifier(saved.uniqueId);
    setPassword(saved.password);
    setAuthMethod("online");
  }, []);

  const handleOfflineAvatarUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setOfflineAvatarPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOnlineLogin = async () => {
    const safeUniqueId = identifier.trim().toLowerCase();
    const safePassword = password.trim();
    if (!safeUniqueId || !safePassword || isSubmittingOnline) return;

    setIsSubmittingOnline(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: makeLoginEmail(safeUniqueId),
      password: safePassword,
    });

    if (error || !data.user) {
      toast({
        title: "Login failed",
        description: error?.message ?? "Please check your credentials and try again.",
        variant: "destructive",
      });
      setIsSubmittingOnline(false);
      return;
    }

    const { data: profileRow } = await supabase.from("profiles").select("display_name, unique_id, avatar_url").eq("user_id", data.user.id).maybeSingle();

    const mappedProfile = await connectToNetwork(profileRow?.display_name ?? safeUniqueId, profileRow?.avatar_url ?? undefined, profileRow?.unique_id ?? safeUniqueId);

    if (!mappedProfile) {
      toast({
        title: "Could not load profile",
        description: "Try again after network connection is stable.",
        variant: "destructive",
      });
      setIsSubmittingOnline(false);
      return;
    }

    cacheOnlineCredentialsForLogout(safeUniqueId, safePassword);
    saveLocalProfileSnapshot(mappedProfile, "online");
    navigate("/permissions", { replace: true });
    setIsSubmittingOnline(false);
  };

  const handleOfflineLogin = () => {
    const safeName = offlineName.trim();
    const safeUniqueId = offlineUniqueId.trim().toLowerCase();

    if (!safeName || !safeUniqueId || isSubmittingOffline) return;

    setIsSubmittingOffline(true);

    const selectedOfflineAvatar = offlineAvatarPreview ?? getAvatarTemplateByIndex(offlineAvatarIndex).dataUrl;
    const mapped = connectOfflineProfile(safeName, selectedOfflineAvatar, safeUniqueId);
    if (!mapped) {
      toast({
        title: "Offline login failed",
        description: "Please check profile details and try again.",
        variant: "destructive",
      });
      setIsSubmittingOffline(false);
      return;
    }

    saveLocalProfileSnapshot(mapped, "offline");
    navigate("/permissions", { replace: true });
    setIsSubmittingOffline(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <section className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-6 shadow-card">
        <Button className="w-fit gap-2 px-0" onClick={() => navigate("/", { replace: true })} type="button" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          {t("login.back")}
        </Button>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("login.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-1">
          <Button onClick={() => setAuthMethod("online")} type="button" variant={authMethod === "online" ? "default" : "ghost"}>
            {t("login.onlineTab")}
          </Button>
          <Button onClick={() => setAuthMethod("offline")} type="button" variant={authMethod === "offline" ? "default" : "ghost"}>
            {t("login.offlineTab")}
          </Button>
        </div>

        {authMethod === "online" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="credential">
                {t("login.uniqueId")}
              </label>
              <Input
                autoComplete="username"
                disabled={isSubmittingOnline}
                id="credential"
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={t("login.uniqueIdPlaceholder")}
                value={identifier}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="password">
                {t("login.password")}
              </label>
              <div className="relative">
                <Input
                  autoComplete="current-password"
                  className="pr-10"
                  disabled={isSubmittingOnline}
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full" disabled={!identifier.trim() || !password.trim() || isSubmittingOnline} onClick={() => void handleOnlineLogin()}>
              {isSubmittingOnline ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("login.loggingIn")}
                </span>
              ) : (
                t("login.button")
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("login.create")} {" "}
              <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/signup">
                {t("login.signup")}
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <ProfileAvatarBar
              onAvatarSelect={(index) => {
                setOfflineAvatarPreview(null);
                setOfflineAvatarIndex(index);
              }}
              onAvatarUpload={handleOfflineAvatarUpload}
              selectedAvatarIndex={offlineAvatarIndex}
              uploadedAvatar={offlineAvatarPreview}
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="offline-name">
                {t("login.name")}
              </label>
              <Input id="offline-name" onChange={(event) => setOfflineName(event.target.value)} placeholder={t("login.namePlaceholder")} value={offlineName} />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="offline-unique-id">
                {t("login.uniqueId")}
              </label>
              <Input
                id="offline-unique-id"
                onChange={(event) => setOfflineUniqueId(event.target.value)}
                placeholder={t("login.uniqueIdPlaceholder")}
                value={offlineUniqueId}
              />
            </div>

            <Button className="w-full gap-2" disabled={!offlineName.trim() || !offlineUniqueId.trim() || isSubmittingOffline} onClick={handleOfflineLogin}>
              <Wifi className="h-4 w-4" />
              {t("login.offlineButton")}
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">{t("login.savedLocal")}</p>
      </section>
    </main>
  );
};

export default Login;
