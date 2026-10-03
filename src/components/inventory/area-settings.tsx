"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveAreaAction } from "@/app/(members)/mitglieder/lager/actions/structure";
import { EditIcon, PlusIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Switch } from "@/components/ui/switch";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";

export type AreaSettingsItem = {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
  inspectionDefault: boolean;
  assetCount: number;
  categories: { id: string; name: string }[];
};

type Draft = {
  id: string | null;
  name: string;
  prefix: string;
  description: string;
  inspectionDefault: boolean;
  locked: boolean;
};

export function AreaSettings({ areas }: { areas: AreaSettingsItem[] }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);

  const run = async (promise: Promise<{ ok: boolean; error?: string; message?: string }>) => {
    const result = await promise;
    if (!result.ok) {
      toast.error(result.error ?? "Fehler");
      return false;
    }
    toast.success(result.message ?? "Gespeichert.");
    router.refresh();
    return true;
  };

  const saveArea = async () => {
    if (!draft) return;
    setSaving(true);
    const ok = await run(
      saveAreaAction(draft.id, {
        name: draft.name,
        prefix: draft.prefix,
        description: draft.description,
        inspectionDefault: draft.inspectionDefault,
      }),
    );
    setSaving(false);
    if (ok) setDraft(null);
  };

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        onClick={() =>
          setDraft({
            id: null,
            name: "",
            prefix: "",
            description: "",
            inspectionDefault: false,
            locked: false,
          })
        }
      >
        <PlusIcon className="mr-2 h-4 w-4" />
        Bereich anlegen
      </Button>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {areas.map((area) => (
          <section
            key={area.id}
            className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-mono font-semibold text-primary">
                {area.prefix}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-foreground">{area.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {area.assetCount} Objekte · Codes {area.prefix}-0001 …
                  {area.inspectionDefault ? " · standardmäßig prüfpflichtig" : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${area.name} bearbeiten`}
                onClick={() =>
                  setDraft({
                    id: area.id,
                    name: area.name,
                    prefix: area.prefix,
                    description: area.description ?? "",
                    inspectionDefault: area.inspectionDefault,
                    locked: area.assetCount > 0,
                  })
                }
              >
                <EditIcon />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {area.categories.length} Kategorien ·{" "}
              <Link
                href={`${INVENTORY_BASE_PATH}/katalog`}
                className="font-medium text-primary hover:underline"
              >
                Kategorien & Merkmale pflegen
              </Link>
            </p>
          </section>
        ))}
      </div>

      <ResponsivePanel
        open={draft !== null}
        onOpenChange={(open) => (!open ? setDraft(null) : undefined)}
        title={draft?.id ? "Bereich bearbeiten" : "Bereich anlegen"}
        description="Lagerbereich bearbeiten"
        footer={
          <Button
            className="w-full"
            size="lg"
            disabled={saving || !draft?.name.trim() || !draft?.prefix.trim()}
            onClick={saveArea}
          >
            {saving ? "Speichert …" : "Speichern"}
          </Button>
        }
      >
        {draft ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="area-name">Name</Label>
                <Input
                  id="area-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="area-prefix">Kürzel</Label>
                <Input
                  id="area-prefix"
                  value={draft.prefix}
                  maxLength={3}
                  disabled={draft.locked}
                  className="font-mono uppercase"
                  onChange={(event) =>
                    setDraft({ ...draft, prefix: event.target.value.toUpperCase() })
                  }
                />
              </div>
            </div>
            {draft.locked ? (
              <p className="text-xs text-muted-foreground">
                Das Kürzel steht schon auf Etiketten und bleibt fest.
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="area-description">Beschreibung</Label>
              <Input
                id="area-description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span className="text-sm text-foreground">Neue Objekte sind prüfpflichtig</span>
              <Switch
                checked={draft.inspectionDefault}
                onCheckedChange={(checked) => setDraft({ ...draft, inspectionDefault: checked })}
                aria-label="Standardmäßig prüfpflichtig"
              />
            </label>
          </div>
        ) : null}
      </ResponsivePanel>
    </div>
  );
}
