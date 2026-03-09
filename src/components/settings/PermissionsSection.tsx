import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PermissionsSection = () => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-accent">
          <ShieldCheck className="h-4 w-4" />
          Permissions
        </CardTitle>
        <CardDescription>Permission information and quick access</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Highlighted permissions keep chat, scan, notifications, media and nearby detection reliable.
        </p>
        <Button className="w-full justify-between" onClick={() => navigate("/permissions")} type="button" variant="outline">
          <span>Click to show all permission</span>
          <span className="text-xs text-muted-foreground">Open</span>
        </Button>
      </CardContent>
    </Card>
  );
};

export default PermissionsSection;
