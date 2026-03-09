import { ArrowRight, Globe2, Languages, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Preferences } from "@capacitor/preferences";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AppLanguage, useAppLanguage } from "@/lib/i18n";

const Index = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t, languages } = useAppLanguage();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between bg-background px-4 py-8">
      <section className="flex flex-1 flex-col items-center justify-center space-y-6 rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-card">
        <img alt="AirTalk logo" className="h-20 w-20 rounded-2xl border border-border bg-background p-2" src="/favicon.ico" />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("intro.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro.goal")}</p>
        </div>

        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <Radio className="h-3.5 w-3.5" /> {t("intro.welcome")}
        </p>

        <div className="w-full space-y-2 text-left">
          <p className="text-xs font-medium text-muted-foreground">{t("intro.selectLanguage")}</p>
          <Select onValueChange={(value) => setLanguage(value as AppLanguage)} value={language}>
            <SelectTrigger>
              <SelectValue placeholder="Choose language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("intro.saved")}</p>
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <Button className="w-full gap-2" onClick={async () => { await Preferences.set({ key: 'hasSeenIntro', value: 'true' }); navigate("/login", { replace: true }); }} size="lg" type="button">
          {t("intro.start")} <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Languages className="h-3.5 w-3.5" />
          {t("intro.currentLanguage")}: {language}
          <Globe2 className="h-3.5 w-3.5" />
        </p>
      </section>
    </main>
  );
};

export default Index;
