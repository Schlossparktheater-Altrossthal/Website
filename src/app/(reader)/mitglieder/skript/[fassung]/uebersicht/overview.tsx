"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ArrowLeftIcon, DownloadIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  CUE_LABELS,
  SCENE_TABLE_COLUMNS,
  SCENE_TABLE_COLUMN_LABELS,
  sceneShortLabel,
  type MatrixCell,
  type SceneTableColumn,
} from "@/lib/skript/export-options";
import type { ScriptReaderData } from "@/lib/skript/reader";
import {
  CUE_CATEGORIES,
  formatDuration,
  parseDurationInput,
  type ScriptStats,
} from "@/lib/skript/stats";
import { cueListCsv, matrixCsv, roleStatsCsv, sceneTableCsv } from "@/lib/skript/stats-csv";
import type { CueCategory } from "@/lib/skript/types";
import { cn } from "@/lib/utils";

import { saveSceneDurationAction } from "../../scene-time-actions";
import { CUE_STYLE, useSettings } from "../../shared";

/** Übersichten im Leser: Rollen, Szenen, Auftritte, Technik – sortierbar, als CSV (Phase 5). */

type Tab = "rollen" | "szenen" | "auftritte" | "technik";
type RoleSort = "name" | "words" | "passages" | "longest" | "scenes";

const NUMBER = new Intl.NumberFormat("de-DE");
const PERCENT = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });

function download(csv: string, name: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const th = "px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
const td = "px-2 py-2 align-top";

export function ScriptOverview({
  version,
  stats,
  roleNames,
  ownRoleIds,
  canManage,
}: {
  version: ScriptReaderData["version"];
  stats: ScriptStats;
  roleNames: [string, string][];
  ownRoleIds: string[];
  /** Skript-Verwaltung: gemessene Szenendauer eintragen. */
  canManage: boolean;
}) {
  const [settings, update] = useSettings(version.showId, ownRoleIds);
  const [tab, setTab] = React.useState<Tab>("rollen");
  const names = React.useMemo(() => new Map(roleNames), [roleNames]);
  const sceneTitles = React.useMemo(
    () => new Map(stats.scenes.map((scene) => [scene.id, scene.title])),
    [stats.scenes],
  );
  const mine = new Set(settings.roleIds);
  const fileBase = `${slug(version.showTitle)}-${slug(version.label)}`;

  const exportCsv = () => {
    if (tab === "rollen") download(roleStatsCsv(stats), `${fileBase}-rollen.csv`);
    if (tab === "szenen") {
      download(sceneTableCsv(stats, names, settings.pdfSceneColumns), `${fileBase}-szenen.csv`);
    }
    if (tab === "auftritte") {
      download(matrixCsv(stats, settings.pdfMatrixCell), `${fileBase}-auftritte.csv`);
    }
    if (tab === "technik") download(cueListCsv(stats, sceneTitles), `${fileBase}-technik.csv`);
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center gap-1 px-1 lg:px-4">
          <Button asChild variant="ghost" size="icon" aria-label="Zurück zum Skript">
            <Link href={`/mitglieder/skript/${version.id}`}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-medium">Übersichten</p>
            <p className="truncate text-xs text-muted-foreground">
              {version.showTitle} · {version.label}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={exportCsv}>
            <DownloadIcon aria-hidden /> CSV
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-[1240px] space-y-4 px-3 py-4 lg:px-6">
        <div className="grid grid-cols-3 gap-2 text-center sm:max-w-md">
          <Stat label="Wörter" value={NUMBER.format(stats.totalWords)} />
          <Stat label="Passagen" value={NUMBER.format(stats.totalPassages)} />
          <Stat
            label={stats.duration.estimated ? "Dauer (teils geschätzt)" : "Dauer (gemessen)"}
            value={formatDuration(stats.duration)}
          />
        </div>

        <SegmentedControl<Tab>
          aria-label="Übersicht"
          fullWidth
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "rollen", label: "Rollen" },
            { value: "szenen", label: "Szenen" },
            { value: "auftritte", label: "Auftritte" },
            { value: "technik", label: "Technik" },
          ]}
        />

        {tab === "rollen" ? <RoleTable stats={stats} mine={mine} /> : null}
        {tab === "szenen" ? (
          <SceneTable
            stats={stats}
            names={names}
            mine={mine}
            columns={settings.pdfSceneColumns}
            onColumns={(pdfSceneColumns) => update({ pdfSceneColumns })}
            canManage={canManage}
          />
        ) : null}
        {tab === "auftritte" ? (
          <Matrix
            stats={stats}
            mine={mine}
            cell={settings.pdfMatrixCell}
            onCell={(pdfMatrixCell) => update({ pdfMatrixCell })}
          />
        ) : null}
        {tab === "technik" ? <CueList stats={stats} sceneTitles={sceneTitles} /> : null}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 px-2 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function RoleTable({ stats, mine }: { stats: ScriptStats; mine: Set<string> }) {
  const [sort, setSort] = React.useState<RoleSort>("words");
  const rows = React.useMemo(() => {
    const value = (role: ScriptStats["roles"][number]) =>
      ({
        name: 0,
        words: role.words,
        passages: role.passages,
        longest: role.longestPassage,
        scenes: role.sceneIds.length,
      })[sort];
    return [...stats.roles].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name, "de") : value(b) - value(a),
    );
  }, [stats.roles, sort]);
  const max = Math.max(1, ...stats.roles.map((role) => role.words));
  const header = (key: RoleSort, label: string, right = true) => (
    <th className={cn(th, right && "text-right")} aria-sort={sort === key ? "descending" : "none"}>
      <button
        type="button"
        onClick={() => setSort(key)}
        className={cn("min-h-8 uppercase", sort === key && "text-foreground")}
      >
        {label}
        {sort === key ? " ▾" : ""}
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {header("name", "Rolle", false)}
            {header("words", "Wörter")}
            <th className={cn(th, "text-right sm:w-1/4 sm:text-left")}>Anteil</th>
            {header("passages", "Pass.")}
            {header("longest", "Längste")}
            {header("scenes", "Szenen")}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((role) => (
            <tr key={role.id} className={cn(mine.has(role.id) && "bg-primary/10")}>
              <td className={cn(td, "font-medium")}>{role.name}</td>
              <td className={cn(td, "text-right tabular-nums")}>{NUMBER.format(role.words)}</td>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <div className="hidden h-2 flex-1 rounded-full bg-muted sm:block">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(role.words / max) * 100}%` }}
                    />
                  </div>
                  <span className="ml-auto w-12 text-right text-xs tabular-nums text-muted-foreground">
                    {PERCENT.format(role.share)}
                  </span>
                </div>
              </td>
              <td className={cn(td, "text-right tabular-nums")}>{role.passages}</td>
              <td className={cn(td, "text-right tabular-nums")}>{role.longestPassage}</td>
              <td className={cn(td, "text-right tabular-nums")}>{role.sceneIds.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chips<T extends string>({
  all,
  selected,
  label,
  onToggle,
}: {
  all: readonly T[];
  selected: readonly T[];
  label: (value: T) => string;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((value) => {
        const on = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(value)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-sm",
              on
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {label(value)}
          </button>
        );
      })}
    </div>
  );
}

function SceneTable({
  stats,
  names,
  mine,
  columns,
  onColumns,
  canManage,
}: {
  stats: ScriptStats;
  names: Map<string, string>;
  mine: Set<string>;
  columns: SceneTableColumn[];
  onColumns: (columns: SceneTableColumn[]) => void;
  canManage: boolean;
}) {
  const scenes = stats.scenes.filter(
    (scene) => scene.passages > 0 || CUE_CATEGORIES.some((c) => scene.cues[c].length),
  );
  const toggle = (column: SceneTableColumn) =>
    onColumns(
      columns.includes(column)
        ? columns.filter((c) => c !== column)
        : SCENE_TABLE_COLUMNS.filter((c) => c === column || columns.includes(c)),
    );
  const isCue = (column: SceneTableColumn): column is CueCategory =>
    (CUE_CATEGORIES as readonly string[]).includes(column);
  return (
    <div className="space-y-3">
      <Chips
        all={SCENE_TABLE_COLUMNS}
        selected={columns}
        label={(c) => SCENE_TABLE_COLUMN_LABELS[c]}
        onToggle={toggle}
      />
      <p className="text-xs text-muted-foreground">
        Dauer mit „ca.“ ist aus dem gesprochenen Text geschätzt (ohne Spiel, Musik, Umbauten).
        {canManage ? " Antippen, um eine gemessene Zeit einzutragen (z. B. 12:30)." : ""}
      </p>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className={cn(th, "sticky left-0 bg-muted")}>Szene</th>
              {columns.map((column) => (
                <th
                  key={column}
                  className={cn(th, !isCue(column) && column !== "roles" && "text-right")}
                >
                  {SCENE_TABLE_COLUMN_LABELS[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {scenes.map((scene) => (
              <tr key={scene.id}>
                <td
                  className={cn(
                    td,
                    "sticky left-0 max-w-[11rem] bg-background font-medium",
                    scene.roles.some((role) => mine.has(role.id)) && "border-l-2 border-l-primary",
                  )}
                >
                  {scene.title}
                </td>
                {columns.map((column) => (
                  <td
                    key={column}
                    className={cn(
                      td,
                      !isCue(column) && column !== "roles" && "text-right tabular-nums",
                    )}
                  >
                    {column === "roles" ? (
                      <>
                        {scene.roles.map((role, index) => (
                          <span
                            key={role.id}
                            className={cn(mine.has(role.id) && "font-semibold text-primary")}
                          >
                            {index ? ", " : ""}
                            {names.get(role.id) ?? role.id}
                          </span>
                        ))}
                        {scene.mentionedRoleIds.length ? (
                          <span className="block text-xs text-muted-foreground">
                            ohne Text:{" "}
                            {scene.mentionedRoleIds.map((id) => names.get(id) ?? id).join(", ")}
                          </span>
                        ) : null}
                      </>
                    ) : column === "words" ? (
                      NUMBER.format(scene.words)
                    ) : column === "passages" ? (
                      scene.passages
                    ) : column === "pages" ? (
                      scene.pages ? (
                        scene.pages.from === scene.pages.to ? (
                          scene.pages.from
                        ) : (
                          `${scene.pages.from}–${scene.pages.to}`
                        )
                      ) : (
                        ""
                      )
                    ) : column === "duration" ? (
                      scene.words ? (
                        formatDuration(scene.duration)
                      ) : (
                        ""
                      )
                    ) : scene.cues[column].length ? (
                      <span title={scene.cues[column].map((cue) => cue.text).join("\n")}>
                        <span className="font-medium">{scene.cues[column].length}</span>
                        <span className="block text-xs text-muted-foreground">
                          Nr. {scene.cues[column].map((cue) => cue.number).join(", ")}
                        </span>
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DurationCell({ scene }: { scene: ScriptStats["scenes"][number] }) {
  const router = useRouter();
  const measured = !scene.duration.estimated;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const label = scene.words || measured ? formatDuration(scene.duration) : "–";

  const save = async () => {
    const seconds = parseDurationInput(value);
    if (Number.isNaN(seconds)) {
      toast.error("Bitte als Minuten oder mm:ss eingeben, z. B. 12:30");
      return;
    }
    setBusy(true);
    const result = await saveSceneDurationAction({ sceneId: scene.id, seconds });
    setBusy(false);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error });
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (editing) {
    return (
      <input
        autoFocus
        inputMode="numeric"
        disabled={busy}
        aria-label={`Gemessene Dauer für ${scene.title}`}
        placeholder="mm:ss"
        className="h-9 w-20 rounded-md border border-input bg-background px-2 text-right text-sm"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setValue(
          measured
            ? `${Math.floor(scene.duration.seconds / 60)}:${String(scene.duration.seconds % 60).padStart(2, "0")}`
            : "",
        );
        setEditing(true);
      }}
      title={
        measured
          ? "Gemessen – antippen zum Ändern, leeren zum Entfernen"
          : "Gemessene Zeit eintragen"
      }
      className={cn(
        "min-h-9 rounded px-1 underline decoration-dotted underline-offset-4 hover:bg-muted",
        measured ? "font-medium" : "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Matrix({
  stats,
  mine,
  cell,
  onCell,
}: {
  stats: ScriptStats;
  mine: Set<string>;
  cell: MatrixCell;
  onCell: (cell: MatrixCell) => void;
}) {
  const scenes = stats.scenes.filter((scene) => scene.passages > 0);
  const lookup = new Map(
    scenes.map((scene) => [scene.id, new Map(scene.roles.map((role) => [role.id, role]))]),
  );
  return (
    <div className="space-y-3">
      <SegmentedControl<MatrixCell>
        aria-label="Inhalt der Zellen"
        value={cell}
        onValueChange={onCell}
        options={[
          { value: "mark", label: "Punkt" },
          { value: "words", label: "Wörter" },
          { value: "passages", label: "Passagen" },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        ● spricht · ○ nur in Regieanweisungen genannt · Szenenname beim Antippen der Spalte
      </p>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className={cn(th, "sticky left-0 z-10 bg-muted")}>Rolle</th>
              {scenes.map((scene) => (
                <th key={scene.id} className={cn(th, "min-w-9 text-center")} title={scene.title}>
                  {sceneShortLabel(scene.title, stats.scenes.indexOf(scene))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {stats.roles.map((role) => (
              <tr key={role.id} className={cn(mine.has(role.id) && "bg-primary/10")}>
                <td
                  className={cn(
                    td,
                    "sticky left-0 z-10 max-w-[9rem] truncate font-medium",
                    mine.has(role.id) ? "bg-primary/10 backdrop-blur" : "bg-background",
                  )}
                >
                  {role.name}
                </td>
                {scenes.map((scene) => {
                  const entry = lookup.get(scene.id)?.get(role.id);
                  return (
                    <td
                      key={scene.id}
                      className="px-1 py-2 text-center tabular-nums"
                      title={`${role.name} · ${scene.title}`}
                    >
                      {entry ? (
                        cell === "mark" ? (
                          "●"
                        ) : cell === "words" ? (
                          entry.words
                        ) : (
                          entry.passages
                        )
                      ) : scene.mentionedRoleIds.includes(role.id) ? (
                        <span className="text-muted-foreground">○</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CueList({ stats, sceneTitles }: { stats: ScriptStats; sceneTitles: Map<string, string> }) {
  const present = CUE_CATEGORIES.filter((c) => stats.cues.some((cue) => cue.category === c));
  const [shown, setShown] = React.useState<CueCategory[]>(present);
  const cues = stats.cues.filter((cue) => shown.includes(cue.category));
  return (
    <div className="space-y-3">
      <Chips
        all={present}
        selected={shown}
        label={(c) => CUE_LABELS[c]}
        onToggle={(c) =>
          setShown((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
        }
      />
      <p className="text-xs text-muted-foreground">
        {cues.length} Hinweise · Stichwort = letzte gesprochene Wörter davor
      </p>
      <ol className="divide-y divide-border/60 rounded-md border border-border/60">
        {cues.map((cue, index) => {
          const heading =
            cues[index - 1]?.sceneId !== cue.sceneId ? sceneTitles.get(cue.sceneId) : null;
          return (
            <React.Fragment key={`${cue.category}-${cue.number}`}>
              {heading ? (
                <li className="bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {heading}
                </li>
              ) : null}
              <li className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 px-3 py-2 text-sm sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_3rem]">
                <span
                  className={cn(
                    "h-fit rounded px-1.5 py-0.5 text-xs font-semibold",
                    CUE_STYLE[cue.category].className,
                  )}
                >
                  {CUE_LABELS[cue.category]} {cue.number}
                </span>
                <span className="min-w-0 break-words">{cue.text}</span>
                <span className="col-start-2 min-w-0 break-words text-xs text-muted-foreground sm:col-start-auto sm:text-sm">
                  {cue.after ? `…${cue.after}` : "(Szenenanfang)"}
                </span>
                <span className="hidden text-right text-xs text-muted-foreground sm:block">
                  {cue.page != null ? `S. ${cue.page}` : ""}
                </span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}
