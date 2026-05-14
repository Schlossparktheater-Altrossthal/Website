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
  const memberPages = useMemo(() => membersNavigation.flatMap((group) => group.items.map((item) => item.label)), []);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [pageVisibility, setPageVisibility] = useState<ClientWebsiteSettings["pageVisibility"]>({
    public: { about: true, mystery: true, schoolCat: true, timeline: true },
    members: {},
    pages: { general: true, maintenance: true, ui: true, websiteTheme: true },
    categories: { dateisystem: { enabled: true, archive: true, images: true, timeline: true, data: true } },
  });
  const [pendingPublic, setPendingPublic] = useState(pageVisibility.public);
  const [pendingMembers, setPendingMembers] = useState<Record<string, boolean>>({});
  const [savingPage, setSavingPage] = useState<string | null>(null);

  useEffect(() => {
    const initialMembers = Object.fromEntries(memberPages.map((name) => [name, true]));
    setPendingMembers(initialMembers);
  }, [memberPages]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      const response = await fetch("/api/website/settings", { cache: "no-store" });
      if (!response.ok) {
        toast.error("Einstellungen konnten nicht geladen werden");
        return;
      }
      const payload = (await response.json()) as { settings?: ClientWebsiteSettings };
      if (!mounted || !payload.settings) return;
      setMaintenanceMode(payload.settings.maintenanceMode);
      setPageVisibility(payload.settings.pageVisibility);
      setPendingPublic(payload.settings.pageVisibility.public);
      const membersFromSettings = payload.settings.pageVisibility.members ?? {};
      setPendingMembers(Object.fromEntries(memberPages.map((name) => [name, membersFromSettings[name] ?? true])));
    };
    void loadSettings();
    return () => {
      mounted = false;
    };
  }, [memberPages]);

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

  const saveVisibility = async (partial: { public?: Record<string, boolean>; members?: Record<string, boolean> }, key: string) => {
    setSavingPage(key);
    const nextVisibility = { ...pageVisibility, ...partial };
    const res = await fetch("/api/website/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { pageVisibility: nextVisibility } }),
    });
    setSavingPage(null);
    if (!res.ok) {
      toast.error("Seitenstatus konnte nicht gespeichert werden");
      return;
    }
    setPageVisibility(nextVisibility);
    toast.success("Seitenstatus gespeichert");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Seitensteuerung</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Wartungsmodus</CardTitle>
            <Badge variant={maintenanceMode ? "warning" : "muted"}>{maintenanceMode ? "Aktiv" : "Inaktiv"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span>Wartungsmodus aktiv</span>
            <Switch checked={maintenanceMode} disabled={savingMaintenance} onCheckedChange={updateMaintenance} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Öffentliche Seiten</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {publicPages.map((page) => (
            <div key={page.key} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
              <span>{page.label}</span>
              <Dialog>
                <DialogTrigger asChild><Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{page.label} konfigurieren</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`public-${page.key}`}>Seite aktivieren</Label>
                      <Switch id={`public-${page.key}`} checked={pendingPublic[page.key]} onCheckedChange={(checked) => setPendingPublic((prev) => ({ ...prev, [page.key]: checked }))} />
                    </div>
                    <Button disabled={savingPage === page.key} onClick={() => void saveVisibility({ public: { ...pageVisibility.public, [page.key]: pendingPublic[page.key] } }, page.key)}>Speichern</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mitglieder-Seiten ({memberPages.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {memberPages.map((name) => (
            <div key={name} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
              <span>{name}</span>
              <Dialog>
                <DialogTrigger asChild><Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{name} konfigurieren</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`member-${name}`}>Seite aktivieren</Label>
                      <Switch id={`member-${name}`} checked={pendingMembers[name] ?? true} onCheckedChange={(checked) => setPendingMembers((prev) => ({ ...prev, [name]: checked }))} />
                    </div>
                    <Button disabled={savingPage === name} onClick={() => void saveVisibility({ members: { ...pageVisibility.members, [name]: pendingMembers[name] ?? true } }, name)}>Speichern</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
