"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function WartungsmodusManager() {
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const update = async (next: boolean) => {
    setActive(next); setSaving(true);
    const res = await fetch('/api/website/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:{maintenanceMode:next}})});
    setSaving(false);
    if (!res.ok) { setActive(!next); toast.error('Speichern fehlgeschlagen'); return; }
    toast.success('Wartungsmodus gespeichert');
  };
  return <div className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight">Wartungsmodus</h1><Card><CardHeader><CardTitle>Wartungsmodus</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between"><span>Wartungsmodus aktiv</span><Switch checked={active} disabled={saving} onCheckedChange={update} /></div><Badge variant={active?"warning":"muted"}>{active?"Aktiv":"Inaktiv"}</Badge><p className="text-sm text-muted-foreground">Wenn aktiv, sehen Besucher eine Wartungsseite. Mitglieder-Login bleibt erreichbar.</p></CardContent></Card></div>;
}
