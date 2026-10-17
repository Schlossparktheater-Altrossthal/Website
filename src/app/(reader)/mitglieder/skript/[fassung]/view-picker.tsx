"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ScriptExportPresetItem } from "@/lib/skript/export-options";
import { BUILT_IN_VIEWS, matchesView, pickView, type ScriptView } from "@/lib/skript/view-options";

import { deleteScriptPresetAction, saveScriptPresetAction } from "../preset-actions";
import type { Settings } from "../shared";
import { sanitizeSections } from "./pdf-export";

/**
 * Ansicht wählen, speichern, teilen (docs/Plan/skript-ansicht-plan.md, Phase 5). Eine Ansicht
 * legt fest, was Leser und PDF zeigen – nicht die eigenen Rollen und nichts am Gerät.
 */

export type ViewChoice = { id: string; label: string; hint?: string; view: Partial<ScriptView> };

/** Fertige und gespeicherte Ansichten; `?ansicht=<id>` findet sie hierüber. */
export function viewChoices(presets: readonly ScriptExportPresetItem[]): ViewChoice[] {
  return [
    ...BUILT_IN_VIEWS,
    ...presets.flatMap((preset) =>
      preset.config.view
        ? [
            {
              id: preset.id,
              label: preset.name,
              hint: preset.shared ? "Ansicht für alle im Stück" : "Eigene Ansicht",
              view: preset.config.view,
            },
          ]
        : [],
    ),
  ];
}

export function ViewPicker({
  versionId,
  settings,
  update,
  presets,
  canManage,
}: {
  versionId: string;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  presets: ScriptExportPresetItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<null | { name: string; shared: boolean }>(null);
  const [busy, setBusy] = React.useState(false);
  const current = pickView(settings);
  const choices = viewChoices(presets);
  const active = choices.find((choice) => matchesView(current, choice.view));
  const saved = active ? presets.find((preset) => preset.id === active.id) : undefined;

  const result = (outcome: { ok: boolean; error?: string; message?: string }) => {
    if (!outcome.ok) {
      toast.error("Das hat nicht geklappt", { description: outcome.error, duration: 6000 });
      return false;
    }
    if (outcome.message) toast.success(outcome.message);
    router.refresh();
    return true;
  };
  const save = async () => {
    if (!saving?.name.trim()) return;
    setBusy(true);
    const ok = result(
      await saveScriptPresetAction({
        versionId,
        name: saving.name,
        shared: saving.shared,
        config: {
          sections: sanitizeSections(current.pdfSections),
          sceneColumns: current.pdfSceneColumns,
          matrixCell: current.pdfMatrixCell,
          view: current,
        },
      }),
    );
    setBusy(false);
    if (ok) setSaving(null);
  };
  const copyLink = async (choice: ViewChoice) => {
    const url = `${window.location.origin}/mitglieder/skript/${versionId}?ansicht=${choice.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link kopiert", {
        description: `Wer ihn öffnet, bekommt die Ansicht „${choice.label}“.`,
      });
    } catch {
      toast.message("Link zum Weitergeben", { description: url, duration: 15000 });
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ansichten">
        {choices.map((choice) => (
          <Button
            key={choice.id}
            size="sm"
            variant={active?.id === choice.id ? "default" : "outline"}
            title={choice.hint}
            aria-pressed={active?.id === choice.id}
            onClick={() => update(choice.view)}
          >
            {choice.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {active
          ? (active.hint ?? "")
          : "Eigene Zusammenstellung – unten anpassen und als Ansicht speichern."}{" "}
        Deine Rollen bleiben beim Wechseln erhalten.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {active ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto gap-1 p-0"
            onClick={() => copyLink(active)}
          >
            <LinkIcon className="h-3.5 w-3.5" aria-hidden /> Link zu „{active.label}“ kopieren
          </Button>
        ) : null}
        {saved?.deletable ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              result(await deleteScriptPresetAction(saved.id));
              setBusy(false);
            }}
          >
            Ansicht „{saved.name}“ löschen
          </Button>
        ) : null}
        {!active && !saving ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setSaving({ name: "", shared: false })}
          >
            Als Ansicht speichern
          </Button>
        ) : null}
      </div>
      {saving ? (
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <label className="grid gap-1">
            <span className="text-sm">Name der Ansicht</span>
            <input
              className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={saving.name}
              maxLength={40}
              autoFocus
              placeholder="z. B. Maske & Kostüm"
              onChange={(event) => setSaving({ ...saving, name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") void save();
              }}
            />
          </label>
          {canManage ? (
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              <span>Für alle im Stück</span>
              <Switch
                checked={saving.shared}
                onCheckedChange={(shared) => setSaving({ ...saving, shared })}
                aria-label="Ansicht für alle im Stück"
              />
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSaving(null)}>
              Abbrechen
            </Button>
            <Button size="sm" disabled={busy || !saving.name.trim()} onClick={save}>
              Speichern
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
