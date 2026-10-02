"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createStocktakeAction } from "@/app/(members)/mitglieder/lager/actions/stocktakes";
import { PlusIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";

const ALL = "__all__";

export function StocktakeCreate({
  areas,
  locations,
}: {
  areas: { id: string; name: string }[];
  locations: { id: string; path: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [areaId, setAreaId] = React.useState(ALL);
  const [locationId, setLocationId] = React.useState(ALL);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const result = await createStocktakeAction({
      title,
      areaId: areaId === ALL ? null : areaId,
      locationId: locationId === ALL ? null : locationId,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    router.push(`${INVENTORY_BASE_PATH}/inventur/${result.data.id}`);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Inventur starten
      </Button>
      <ResponsivePanel
        open={open}
        onOpenChange={setOpen}
        title="Inventur starten"
        description="Umfang der Inventur festlegen"
        footer={
          <Button className="w-full" size="lg" disabled={saving || !title.trim()} onClick={save}>
            {saving ? "Startet …" : "Starten"}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="stocktake-title">Titel</Label>
            <Input
              id="stocktake-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="z. B. Inventur Technik Herbst 2026"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bereich</Label>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger aria-label="Bereich">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Bereiche</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ort</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger aria-label="Ort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Orte</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Tipp: Für mehrere Leute lieber das ganze Lager wählen und jede Person scannt ihr Regal
              – der Fortschritt zeigt, wo noch etwas fehlt.
            </p>
          </div>
        </div>
      </ResponsivePanel>
    </>
  );
}
