"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { membersNavigation } from "@/config/members-navigation";
import { toast } from "sonner";
import type { ClientWebsiteSettings } from "@/lib/website-settings";

type PublicPageConfig = {
  key: keyof ClientWebsiteSettings["pageVisibility"]["public"];
  label: string;
};

const publicPages: PublicPageConfig[] = [
  { key: "about", label: "Über uns" },
  { key: "mystery", label: "Das Geheimnis" },
  { key: "schoolCat", label: "Unsere Schulkatze" },
  { key: "timeline", label: "Chronik" },
];

export function SeitensteuerungManager() {
  const memberPages = useMemo(() => membersNavigation.flatMap((g) => g.items.map((i) => i.label)), []);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [pageVisibility, setPageVisibility] = useState<ClientWebsiteSettings["pageVisibility"]["public"]>({
    about: true,
    mystery: true,
    schoolCat: true,
    timeline: true,
  });
  const [pendingPageVisibility, setPendingPageVisibility] = useState(pageVisibility);
  const [savingPage, setSavingPage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      const response = await fetch("/api/website/settings", { cache: "no-store" });
      if (!response.ok) {
        toast.error("Einstellungen konnten nicht geladen werden");
        return;
      }

      const payload = (await response.json()) as { settings?: ClientWebsiteSettings };
      if (!mounted || !payload.settings) {
        return;
      }

      setMaintenanceMode(payload.settings.maintenanceMode);
      setPageVisibility(payload.settings.pageVisibility.public);
      setPendingPageVisibility(payload.settings.pageVisibility.public);
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const updateMaintenance = async (next: boolean) => {
    setMaintenanceMode(next);
    setSavingMaintenance(true);
    const res = await fetch("/api/website/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { maintenanceMode: next } }),
    });
    setSavingMaintenance(false);
    if (!res.ok) {
      setMaintenanceMode(!next);
      toast.error("Speichern fehlgeschlagen");
      return;
    }
    toast.success("Wartungsmodus gespeichert");
  };

  const savePublicPageVisibility = async (pageKey: PublicPageConfig["key"]) => {
    setSavingPage(pageKey);
    const nextPublic = { ...pageVisibility, [pageKey]: pendingPageVisibility[pageKey] };

    const res = await fetch("/api/website/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          pageVisibility: {
            public: nextPublic,
          },
        },
      }),
    });

    setSavingPage(null);

    if (!res.ok) {
      setPendingPageVisibility(pageVisibility);
      toast.error("Seitenstatus konnte nicht gespeichert werden");
      return;
    }

    setPageVisibility(nextPublic);
    toast.success("Seitenstatus gespeichert");
  };

  const render = (page: PublicPageConfig) => (
    <div key={page.key} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
      <span>{page.label}</span>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Einstellungen für ${page.label}`}>
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{page.label} konfigurieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor={`visibility-${page.key}`}>Seite aktivieren</Label>
              <Switch
                id={`visibility-${page.key}`}
                checked={pendingPageVisibility[page.key]}
                onCheckedChange={(checked) =>
                  setPendingPageVisibility((prev) => ({
                    ...prev,
                    [page.key]: checked,
                  }))}
              />
            </div>
            <Button onClick={() => void savePublicPageVisibility(page.key)} disabled={savingPage === page.key}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Seitensteuerung</h1>
      <Card>
        <CardHeader>
          <CardTitle>Wartungsmodus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Wartungsmodus aktiv</span>
            <Switch checked={maintenanceMode} disabled={savingMaintenance} onCheckedChange={updateMaintenance} />
          </div>
          <Badge variant={maintenanceMode ? "warning" : "muted"}>{maintenanceMode ? "Aktiv" : "Inaktiv"}</Badge>
          <p className="text-sm text-muted-foreground">
            Wenn aktiv, sehen Besucher eine Wartungsseite. Mitglieder-Login bleibt erreichbar.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Öffentliche Seiten</CardTitle></CardHeader>
        <CardContent className="space-y-3">{publicPages.map(render)}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Mitglieder-Seiten</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {memberPages.length} Seiten sind vorhanden. Die Mitglieder-Seitensteuerung folgt im nächsten Schritt.
        </CardContent>
      </Card>
    </div>
  );
}
