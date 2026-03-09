import { ArrowLeft, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSparkMesh } from "@/context/SparkMeshContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cacheOnlineCredentialsForLogout, loadLocalProfileSnapshot, saveLocalProfileSnapshot } from "@/lib/local-auth-profile";

const makeLoginEmail = (id: string) => `${id.toLowerCase()}@airtalk.local`;

const OfflineUpgradeSignup = () => {
  const navigate = useNavigate();
  const { connectToNetwork, profile } = useSparkMesh();

  const [name, setName] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const offlineSnapshot = loadLocalProfileSnapshot();

    const source = offlineSnapshot ?? profile;
    if (!source) {
      navigate("/login?connect=offline", { replace: true });
      return;
    }

    setName(source.name ?? "");
    setUniqueId(source.uniqueId ?? "");
    setAvatarUrl(source.avatarUrl ?? null);
  }, [navigate, profile]);

  const handleUpgrade = async () => {
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
        title: "Upgrade failed",
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

    const mappedProfile = await connectToNetwork(safeName, avatarUrl ?? undefined, safeUniqueId);
    if (!mappedProfile) {
      toast({
        title: "Could not finish upgrade",
        description: "Please login with your new online account.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    cacheOnlineCredentialsForLogout(safeUniqueId, safePassword);
    saveLocalProfileSnapshot(mappedProfile, "online");

    toast({
      title: "Upgrade complete",
      description: "Your account is now connected to Online Air Talk.",
    });

    navigate("/home", { replace: true });
    setIsSubmitting(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <section className="w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-6 shadow-card">
        <Button className="w-fit gap-2 px-0" onClick={() => navigate("/settings")} type="button" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Button>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Upgrade to Online Air Talk</h1>
          <p className="text-sm text-muted-foreground">Use your offline profile and create an online password.</p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
          {avatarUrl ? <img alt="Offline profile avatar" className="h-12 w-12 rounded-full border border-border object-cover" src={avatarUrl} /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{name || "Offline user"}</p>
            <p className="truncate text-xs text-muted-foreground">@{uniqueId || "offline-id"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="upgrade-name">
            Name
          </label>
          <Input id="upgrade-name" onChange={(event) => setName(event.target.value)} value={name} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="upgrade-unique-id">
            Unique ID
          </label>
          <Input id="upgrade-unique-id" onChange={(event) => setUniqueId(event.target.value)} value={uniqueId} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="upgrade-password">
            Password
          </label>
          <div className="relative">
            <Input
              className="pr-10"
              id="upgrade-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create password"
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((prev) => !prev)} type="button">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button className="w-full gap-2" disabled={!name.trim() || !uniqueId.trim() || !password.trim() || isSubmitting} onClick={() => void handleUpgrade()}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Upgrading...
            </span>
          ) : (
            <>
              <UserPlus className="h-4 w-4" /> Upgrade account
            </>
          )}
        </Button>
      </section>
    </main>
  );
};

export default OfflineUpgradeSignup;
