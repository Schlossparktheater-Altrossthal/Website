"use client";

import { useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { membersNavigation } from "@/config/members-navigation";
import { toast } from "sonner";

const publicPages = ["Startseite", "Über uns", "Das Geheimnis", "Unsere Schulkatze", "Chronik"];

export function SeitensteuerungManager() {
  const memberPages = useMemo(() => membersNavigation.flatMap((g) => g.items.map((i) => i.label)), []);
  const [state, setState] = useState<Record<string, boolean>>({});
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const save = async (key: string, val: boolean) => {
    setState((s) => ({ ...s, [key]: val }));
    const r = await fetch("/api/website/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { pageVisibility: {} } }),
    });
    if (!r.ok) {
      toast.error("Speichern fehlgeschlagen");
    } else {
      toast.success("Seitenstatus gespeichert");
    }
  };

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

  const render = (name: string) => (
    <details key={name} open className="rounded-md border border-border p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        {name}
        <Settings className="h-4 w-4" aria-label="Einstellungen" />
      </summary>
      <div className="pt-3">
        <div className="flex items-center justify-between">
          <span>Seite aktivieren</span>
          <Switch checked={state[name] ?? true} onCheckedChange={(v) => save(name, v)} />
        </div>
      </div>
    </details>
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
        <CardContent className="space-y-3">{memberPages.map(render)}</CardContent>
      </Card>
    </div>
  );
}
