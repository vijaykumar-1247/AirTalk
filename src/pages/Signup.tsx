import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProfileAvatarBar from "@/components/sparkmesh/ProfileAvatarBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSparkMesh } from "@/context/SparkMeshContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAppLanguage } from "@/lib/i18n";
import { cacheOnlineCredentialsForLogout, saveLocalProfileSnapshot } from "@/lib/local-auth-profile";
import { getAvatarTemplateByIndex } from "@/lib/offline-p2p";

const makeLoginEmail = (id: string) => `${id.toLowerCase()}@airtalk.local`;

const Signup = () => {
  const navigate = useNavigate();
  const { connectToNetwork } = useSparkMesh();
  const { t } = useAppLanguage();

  const [name, setName] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAvatarIndex, setSelectedAvatarIndex] = useState(0);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAvatarUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignup = async () => {
    const safeName = name.trim();
    const safeUniqueId = uniqueId.trim().toLowerCase();
    const safePassword = password.trim();

    if (!safeName || !safeUniqueId || !safePassword || isSubmitting) return;

    setIsSubmitting(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: makeLoginEmail(safeUniqueId),
      password: safePassword,
      options: {
        data: {
          display_name: safeName,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (signUpError) {
      toast({
        title: "Signup failed",
        description: signUpError.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: makeLoginEmail(safeUniqueId),
      password: safePassword,
    });

    if (signInError) {
      toast({
        title: "Verify email to continue",
        description: "Account created. Please verify your email before first login.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const selectedAvatar = uploadedAvatar ?? getAvatarTemplateByIndex(selectedAvatarIndex).dataUrl;
    const profile = await connectToNetwork(safeName, selectedAvatar, safeUniqueId);

    if (!profile) {
      toast({
        title: "Could not finish setup",
        description: "Try logging in again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    cacheOnlineCredentialsForLogout(safeUniqueId, safePassword);
    saveLocalProfileSnapshot(profile, "online");
    navigate("/permissions", { replace: true });
    setIsSubmitting(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <section className="w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("signup.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("signup.subtitle")}</p>
        </div>

        <ProfileAvatarBar
          onAvatarSelect={(index) => {
            setUploadedAvatar(null);
            setSelectedAvatarIndex(index);
          }}
          onAvatarUpload={handleAvatarUpload}
          selectedAvatarIndex={selectedAvatarIndex}
          uploadedAvatar={uploadedAvatar}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="signup-name">
            {t("signup.name")}
          </label>
          <Input id="signup-name" onChange={(event) => setName(event.target.value)} placeholder={t("login.namePlaceholder")} value={name} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="signup-unique-id">
            {t("signup.uniqueId")}
          </label>
          <Input id="signup-unique-id" onChange={(event) => setUniqueId(event.target.value)} placeholder={t("login.uniqueIdPlaceholder")} value={uniqueId} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="signup-password">
            {t("signup.password")}
          </label>
          <div className="relative">
            <Input
              className="pr-10"
              id="signup-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("signup.passwordPlaceholder")}
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((prev) => !prev)} type="button">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button className="w-full gap-2" disabled={!name.trim() || !uniqueId.trim() || !password.trim() || isSubmitting} onClick={() => void handleSignup()}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("signup.creating")}
            </span>
          ) : (
            <>
              <UserPlus className="h-4 w-4" /> {t("signup.button")}
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("signup.already")} {" "}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/login?connect=online">
            {t("signup.backLogin")}
          </Link>
        </p>
      </section>
    </main>
  );
};

export default Signup;
