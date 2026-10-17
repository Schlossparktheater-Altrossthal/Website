"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  PrinterIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_SCENE_COLUMNS,
  SCENE_TABLE_COLUMNS,
  SCENE_TABLE_COLUMN_LABELS,
  SCRIPT_PDF_SECTIONS,
  SCRIPT_PDF_SECTION_LABELS,
  type SceneTableColumn,
  type ScriptExportPresetItem,
  type ScriptPdfSection,
} from "@/lib/skript/export-options";
import type { ScriptReaderData } from "@/lib/skript/reader";
import { cn } from "@/lib/utils";

import { deleteScriptPresetAction, saveScriptPresetAction } from "../preset-actions";
import type { Settings } from "../shared";

/** PDF-Export im Leser (docs/Plan/skript-auswertungen-plan.md, Phase 4). */

type Preset = {
  id: string;
  label: string;
  hint: string;
  sections: ScriptPdfSection[];
  sceneColumns?: SceneTableColumn[];
};

const PRESETS: Preset[] = [
  { id: "text", label: "Mein Text", hint: "Nur das Skript", sections: ["script"] },
  {
    id: "lernen",
    label: "Stichwortheft",
    hint: "Eigene Repliken mit Stichwort",
    sections: ["cueScript"],
  },
  {
    id: "regie",
    label: "Regiebuch",
    hint: "Zahlen, Szenen, Auftritte, Skript",
    sections: ["roleStats", "sceneTable", "matrix", "script"],
  },
  {
    id: "technik",
    label: "Technik",
    hint: "Fahrplan, Szenen mit Hinweisen, Skript",
    sections: ["cueList", "sceneTable", "script"],
    sceneColumns: ["duration", "ton", "licht", "nebel", "effekt", "umbau"],
  },
  {
    id: "uebersicht",
    label: "Übersichten",
    hint: "Nur Tabellen, kein Skripttext",
    sections: ["roleStats", "sceneTable", "matrix"],
  },
];

const SECTION_HINTS: Record<ScriptPdfSection, string> = {
  script: "Der Text mit den Einstellungen oben",
  roleStats: "Wörter, Passagen und Anteil je Rolle",
  sceneTable: "Eine Zeile pro Szene, Spalten wählbar",
  matrix: "Wer spricht in welcher Szene",
  cueList: "Alle Hinweise nummeriert mit Stichwort",
  cueScript: "Eigene Repliken mit den letzten Worten davor",
};

const same = <T,>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export function sanitizeSections(value: unknown): ScriptPdfSection[] {
  const list = Array.isArray(value)
    ? value.filter((v): v is ScriptPdfSection => SCRIPT_PDF_SECTIONS.includes(v))
    : [];
  return list.length ? [...new Set(list)] : ["script"];
}

function sanitizeColumns(value: unknown): SceneTableColumn[] {
  return Array.isArray(value)
    ? value.filter((v): v is SceneTableColumn => SCENE_TABLE_COLUMNS.includes(v))
    : DEFAULT_SCENE_COLUMNS;
}

export function PdfExport({
  data,
  settings,
  update,
  presets,
  canManage,
}: {
  data: ScriptReaderData;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  presets: ScriptExportPresetItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<null | { name: string; shared: boolean }>(null);
  const [busy, setBusy] = React.useState(false);
  const { version, roles } = data;
  // Personalisiert: für mich (mit den hervorgehobenen Rollen) oder für ein anderes Mitglied
  // (dessen Rollen laut Besetzung). Nur für dieses Mal, nicht gespeichert.
  const [person, setPerson] = React.useState("");
  const [personShow, setPersonShow] = React.useState<"both" | "role" | "name">("both");
  const sections = sanitizeSections(settings.pdfSections);
  const sceneColumns = sanitizeColumns(settings.pdfSceneColumns);
  const preset = PRESETS.find(
    (p) =>
      same(p.sections, sections) &&
      (!p.sections.includes("sceneTable") ||
        same(p.sceneColumns ?? DEFAULT_SCENE_COLUMNS, sceneColumns)),
  );

  const custom = presets.find(
    (p) =>
      same(p.config.sections, sections) &&
      (!sections.includes("sceneTable") || same(p.config.sceneColumns, sceneColumns)) &&
      (!sections.includes("matrix") || p.config.matrixCell === settings.pdfMatrixCell),
  );
  const builtIn = custom ? undefined : preset;

  const result = (outcome: { ok: boolean; error?: string; message?: string }) => {
    if (!outcome.ok) {
      toast.error("Das hat nicht geklappt", { description: outcome.error, duration: 6000 });
      return false;
    }
    if (outcome.message) toast.success(outcome.message);
    router.refresh();
    return true;
  };
  const savePreset = async () => {
    if (!saving?.name.trim()) return;
    setBusy(true);
    const ok = result(
      await saveScriptPresetAction({
        versionId: version.id,
        name: saving.name,
        shared: saving.shared,
        config: { sections, sceneColumns, matrixCell: settings.pdfMatrixCell },
      }),
    );
    setBusy(false);
    if (ok) setSaving(null);
  };
  const deletePreset = async (id: string) => {
    setBusy(true);
    result(await deleteScriptPresetAction(id));
    setBusy(false);
  };

  const url = (download: boolean) => {
    const params = new URLSearchParams({ fassung: version.id, regie: settings.directions });
    const forOther = person !== "" && person !== data.viewerId;
    if (settings.roleIds.length && !forOther) params.set("rollen", settings.roleIds.join(","));
    if (person) {
      params.set("fuer", person);
      params.set("zeigen", personShow);
    }
    if (settings.hiddenCues.length) params.set("ohne", settings.hiddenCues.join(","));
    if (settings.dimOthers) params.set("abblenden", "1");
    params.set("groesse", String(settings.fontSize));
    if (!settings.pdfCover) params.set("deckblatt", "0");
    if (!same(sections, ["script"])) params.set("teile", sections.join(","));
    if (sections.includes("sceneTable")) params.set("spalten", sceneColumns.join(","));
    if (sections.includes("matrix")) params.set("matrix", settings.pdfMatrixCell);
    // Szenenkopf: gleicher Inhalt wie im Leser, im PDF als Kasten gesetzt.
    if (
      sections.includes("script") &&
      settings.pdfSceneHeader &&
      settings.sceneHeader.mode !== "off"
    ) {
      params.set("kopf", settings.sceneHeader.items.join(",") || "-");
      if (settings.sceneHeader.onlyMine) params.set("kopfnurmeine", "1");
    }
    // Eigene Notizen nicht in die Fassung für jemand anderen.
    if (sections.includes("script") && settings.pdfNotes && settings.showNotes && !forOther) {
      params.set("notizen", "1");
    }
    if (download) params.set("download", "1");
    return `/api/skript/${version.showId}/pdf?${params}`;
  };

  const toggleSection = (section: ScriptPdfSection, on: boolean) => {
    const next = on ? [...sections, section] : sections.filter((s) => s !== section);
    update({ pdfSections: next.length ? next : ["script"] });
  };
  const move = (index: number, delta: -1 | 1) => {
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    update({ pdfSections: next });
  };
  const toggleColumn = (column: SceneTableColumn) =>
    update({
      pdfSceneColumns: sceneColumns.includes(column)
        ? sceneColumns.filter((c) => c !== column)
        : SCENE_TABLE_COLUMNS.filter((c) => c === column || sceneColumns.includes(c)),
    });
  const unselected = SCRIPT_PDF_SECTIONS.filter((section) => !sections.includes(section));

  return (
    <section className="space-y-3 border-t border-border/60 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Drucken / PDF
      </h3>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Vorlagen">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={builtIn?.id === p.id ? "default" : "outline"}
            title={p.hint}
            aria-pressed={builtIn?.id === p.id}
            onClick={() =>
              update({
                pdfSections: p.sections,
                ...(p.sceneColumns ? { pdfSceneColumns: p.sceneColumns } : {}),
                ...(!p.sceneColumns && p.sections.includes("sceneTable")
                  ? { pdfSceneColumns: DEFAULT_SCENE_COLUMNS }
                  : {}),
              })
            }
          >
            {p.label}
          </Button>
        ))}
        {presets.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={custom?.id === p.id ? "default" : "outline"}
            title={p.shared ? "Vorlage für alle im Stück" : "Eigene Vorlage"}
            aria-pressed={custom?.id === p.id}
            onClick={() =>
              update({
                pdfSections: p.config.sections,
                pdfSceneColumns: p.config.sceneColumns,
                pdfMatrixCell: p.config.matrixCell,
              })
            }
          >
            {p.name}
            {p.shared ? <span className="text-xs opacity-70">· Stück</span> : null}
          </Button>
        ))}
      </div>
      {custom?.deletable ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-destructive"
          disabled={busy}
          onClick={() => deletePreset(custom.id)}
        >
          Vorlage „{custom.name}“ löschen
        </Button>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Inhalt in dieser Reihenfolge</p>
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {sections.map((section, index) => (
            <li key={section} className="flex min-h-11 items-center gap-2 px-2">
              <Checkbox
                checked
                aria-label={`${SCRIPT_PDF_SECTION_LABELS[section]} weglassen`}
                onCheckedChange={() => toggleSection(section, false)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{SCRIPT_PDF_SECTION_LABELS[section]}</span>
                <span className="block text-xs text-muted-foreground">
                  {SECTION_HINTS[section]}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={index === 0}
                aria-label={`${SCRIPT_PDF_SECTION_LABELS[section]} nach oben`}
                onClick={() => move(index, -1)}
              >
                <ChevronUpIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={index === sections.length - 1}
                aria-label={`${SCRIPT_PDF_SECTION_LABELS[section]} nach unten`}
                onClick={() => move(index, 1)}
              >
                <ChevronDownIcon aria-hidden />
              </Button>
            </li>
          ))}
          {unselected.map((section) => (
            <li
              key={section}
              className="flex min-h-11 items-center gap-2 px-2 text-muted-foreground"
            >
              <Checkbox
                checked={false}
                aria-label={`${SCRIPT_PDF_SECTION_LABELS[section]} hinzufügen`}
                onCheckedChange={() => toggleSection(section, true)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{SCRIPT_PDF_SECTION_LABELS[section]}</span>
                <span className="block text-xs">{SECTION_HINTS[section]}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {sections.includes("sceneTable") ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Spalten der Szenenübersicht</p>
          <div className="flex flex-wrap gap-1.5">
            {SCENE_TABLE_COLUMNS.map((column) => {
              const on = sceneColumns.includes(column);
              return (
                <button
                  key={column}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleColumn(column)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm",
                    on
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {SCENE_TABLE_COLUMN_LABELS[column]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {sections.includes("matrix") ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Auftritte: in den Zellen steht</p>
          <SegmentedControl<Settings["pdfMatrixCell"]>
            aria-label="Inhalt der Auftrittstabelle"
            fullWidth
            value={settings.pdfMatrixCell}
            onValueChange={(pdfMatrixCell) => update({ pdfMatrixCell })}
            options={[
              { value: "mark", label: "Punkt" },
              { value: "words", label: "Wörter" },
              { value: "passages", label: "Passagen" },
            ]}
          />
        </div>
      ) : null}

      {!custom && !builtIn ? (
        saving ? (
          <div className="space-y-2 rounded-md border border-border/60 p-3">
            <label className="grid gap-1">
              <span className="text-sm">Name der Vorlage</span>
              <input
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={saving.name}
                maxLength={40}
                autoFocus
                placeholder="z. B. Maske & Kostüm"
                onChange={(event) => setSaving({ ...saving, name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void savePreset();
                }}
              />
            </label>
            {canManage ? (
              <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span>Für alle im Stück</span>
                <Switch
                  checked={saving.shared}
                  onCheckedChange={(shared) => setSaving({ ...saving, shared })}
                  aria-label="Vorlage für alle im Stück"
                />
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSaving(null)}>
                Abbrechen
              </Button>
              <Button size="sm" disabled={busy || !saving.name.trim()} onClick={savePreset}>
                Speichern
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaving({ name: "", shared: false })}
          >
            Als Vorlage speichern
          </Button>
        )
      ) : null}

      <label className="grid gap-1">
        <span className="text-sm">Fassung für</span>
        <select
          className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
          value={person}
          onChange={(event) => setPerson(event.target.value)}
        >
          <option value="">Niemand bestimmtes</option>
          {data.viewerId && data.people.some((p) => p.id === data.viewerId) ? (
            <option value={data.viewerId}>Mich</option>
          ) : null}
          {data.people
            .filter((p) => p.id !== data.viewerId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.roleIds.length
                  ? ` (${p.roleIds
                      .map((id) => roles.find((role) => role.id === id)?.name)
                      .filter(Boolean)
                      .join(", ")})`
                  : ""}
              </option>
            ))}
        </select>
      </label>
      {person ? (
        <SegmentedControl<"both" | "role" | "name">
          aria-label="Auf dem Deckblatt"
          fullWidth
          value={personShow}
          onValueChange={setPersonShow}
          options={[
            { value: "both", label: "Name + Rolle" },
            { value: "name", label: "Name" },
            { value: "role", label: "Rolle" },
          ]}
        />
      ) : null}
      {person && person !== data.viewerId ? (
        <p className="text-xs text-muted-foreground">
          Hervorgehoben werden die Rollen dieser Person laut Besetzung.
        </p>
      ) : null}
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Mit Deckblatt und Inhaltsverzeichnis</span>
        <Switch
          checked={settings.pdfCover}
          onCheckedChange={(pdfCover) => update({ pdfCover })}
          aria-label="PDF mit Deckblatt"
        />
      </label>
      {sections.includes("script") && settings.sceneHeader.mode !== "off" ? (
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>Szenenkopf im PDF</span>
          <Switch
            checked={settings.pdfSceneHeader}
            onCheckedChange={(pdfSceneHeader) => update({ pdfSceneHeader })}
            aria-label="Szenenkopf im PDF"
          />
        </label>
      ) : null}
      {sections.includes("script") && settings.showNotes ? (
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block">Meine Notizen im PDF</span>
            <span className="block text-xs text-muted-foreground">
              Markierungen, Zeichen, Notizen und Zettel – nur deine eigenen
            </span>
          </span>
          <Switch
            checked={settings.pdfNotes}
            onCheckedChange={(pdfNotes) => update({ pdfNotes })}
            aria-label="Meine Notizen im PDF"
          />
        </label>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Das Skript zeigt denselben Inhalt wie der Leser – Rollen, Regieanweisungen, sichtbare
        Hinweise, Szenenkopf –, aber fürs Papier gesetzt.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={url(false)} target="_blank" rel="noopener">
            <PrinterIcon aria-hidden /> PDF öffnen
          </a>
        </Button>
        <Button asChild variant="ghost">
          <a href={url(true)}>
            <DownloadIcon aria-hidden /> Herunterladen
          </a>
        </Button>
      </div>
    </section>
  );
}
