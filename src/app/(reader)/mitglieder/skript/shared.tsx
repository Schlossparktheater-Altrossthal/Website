"use client";

import * as React from "react";

import { SCRIPT_CUE_STYLES } from "@/config/category-colors";
import {
  DEFAULT_SCENE_COLUMNS,
  type SceneTableColumn,
  type ScriptPdfSection,
} from "@/lib/skript/export-options";
import type { ScriptReaderData } from "@/lib/skript/reader";
import type { CueCategory, ScriptPart } from "@/lib/skript/types";
import { cn } from "@/lib/utils";

/** Gemeinsame Bausteine von Leser und Fassungsvergleich (docs/Plan/skript-plan.md). */

export const SKRIPT_PATH = "/mitglieder/produktionen/stueck?ansicht=skript";

export const CUE_STYLE: Record<CueCategory, { label: string; className: string }> = {
  ton: { label: "Ton", className: SCRIPT_CUE_STYLES.ton },
  licht: { label: "Licht", className: SCRIPT_CUE_STYLES.licht },
  nebel: { label: "Nebel", className: SCRIPT_CUE_STYLES.nebel },
  effekt: { label: "Effekt", className: SCRIPT_CUE_STYLES.effekt },
  umbau: { label: "Umbau", className: SCRIPT_CUE_STYLES.umbau },
  aus: { label: "Aus dem Off", className: SCRIPT_CUE_STYLES.aus },
  technik: { label: "Technik", className: SCRIPT_CUE_STYLES.technik },
};

/**
 * Längster Name (Zeichen), der noch in die Sprecher-Spalte passt. Längere Namen stehen über
 * der Replik – sonst macht ein einziger langer Name die Spalte für das ganze Stück breit.
 */
export const SPEAKER_MAX_CHARS = 11;

export const FONT_SIZES = ["text-[15px]", "text-base", "text-lg", "text-xl"] as const;

export type Visibility = "show" | "dim" | "hide";

export type Settings = {
  fontSize: number;
  directions: Visibility;
  /** Hinweise als Zeile unter dem Satz (Standard) oder wie im PDF mitten im Text. */
  cueLayout: "below" | "inline";
  hiddenCues: CueCategory[];
  followedCues: CueCategory[];
  roleIds: string[];
  dimOthers: boolean;
  keepAwake: boolean;
  /** Probenmodus: Werte vor dem Einschalten, damit Ausschalten sie zurückholt (null = aus). */
  rehearsalBackup: Pick<Settings, "fontSize" | "keepAwake" | "dimOthers"> | null;
  pdfCover: boolean;
  /** PDF-Abschnitte in Reihenfolge, Spalten der Szenenübersicht, Inhalt der Auftrittstabelle. */
  pdfSections: ScriptPdfSection[];
  pdfSceneColumns: SceneTableColumn[];
  pdfMatrixCell: "mark" | "words" | "passages";
  showNotes: boolean;
};

const DEFAULT_SETTINGS: Omit<Settings, "roleIds"> = {
  fontSize: 0,
  directions: "show",
  cueLayout: "below",
  hiddenCues: [],
  followedCues: [],
  dimOthers: false,
  keepAwake: true,
  rehearsalBackup: null,
  pdfCover: true,
  pdfSections: ["script"],
  pdfSceneColumns: DEFAULT_SCENE_COLUMNS,
  pdfMatrixCell: "mark",
  showNotes: true,
};

/** Einstellungen je Stück im Browser (nur Komfort, E: localStorage nur für Ansicht). */
export function readStored<T>(key: string): Partial<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch (error) {
    console.warn("Leser-Einstellungen nicht lesbar", error);
    return null;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Leser-Einstellungen nicht speicherbar", error);
  }
}

export function useSettings(showId: string, ownRoleIds: string[]) {
  const key = `skript-leser:${showId}`;
  const [settings, setSettings] = React.useState<Settings>({
    ...DEFAULT_SETTINGS,
    roleIds: ownRoleIds,
  });
  const loaded = React.useRef(false);
  React.useEffect(() => {
    const stored = readStored<Settings>(key);
    if (stored) setSettings((current) => ({ ...current, ...stored }));
    loaded.current = true;
  }, [key]);
  const update = React.useCallback(
    (patch: Partial<Settings>) =>
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (loaded.current) writeStored(key, next);
        return next;
      }),
    [key],
  );
  return [settings, update] as const;
}

export function CueMark({ part }: { part: Extract<ScriptPart, { kind: "cue" }> }) {
  const style = CUE_STYLE[part.category];
  return (
    <span
      className={cn(
        "mx-0.5 inline border-l-[3px] px-1.5 py-px text-[0.87em] not-italic text-foreground [box-decoration-break:clone]",
        style.className,
      )}
    >
      {part.text.toLowerCase().startsWith(style.label.toLowerCase()) ? (
        <span className="sr-only">{style.label}: </span>
      ) : (
        <span className="mr-1 text-[0.7em] font-bold uppercase tracking-wider opacity-70">
          {style.label}
        </span>
      )}
      {part.text}
    </span>
  );
}

/** Farbe der Hinweismarke im Text (nur die Gewerksfarbe, kein Hintergrund). */
const CUE_MARK_COLOR: Record<CueCategory, { bar: string; text: string }> = {
  ton: { bar: "bg-yellow-400", text: "text-yellow-600 dark:text-yellow-400" },
  licht: { bar: "bg-cyan-400", text: "text-cyan-600 dark:text-cyan-400" },
  nebel: { bar: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  effekt: { bar: "bg-fuchsia-400", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  umbau: { bar: "bg-red-400", text: "text-red-600 dark:text-red-400" },
  aus: { bar: "bg-zinc-400", text: "text-zinc-500 dark:text-zinc-400" },
  technik: { bar: "bg-orange-400", text: "text-orange-600 dark:text-orange-400" },
};

/** Stelle eines Hinweises im Satz: feiner Strich, bei mehreren mit Ziffer. Nicht antippbar. */
export function CueMarker({ category, number }: { category: CueCategory; number: number | null }) {
  const color = CUE_MARK_COLOR[category];
  return (
    <span aria-hidden className="mx-0.5 select-none whitespace-nowrap">
      <span className={cn("inline-block h-[0.9em] w-[2px] align-[-0.1em]", color.bar)} />
      {number ? (
        <span
          className={cn(
            "ml-px align-super text-[0.62em] font-bold not-italic leading-none",
            color.text,
          )}
        >
          {number}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Hinweiszeile unter (oder über) einem Satz. Ruhig mit Farbbalken; Gewerke, denen man folgt,
 * behalten die volle Farbfläche.
 */
export function CueRow({
  cues,
  followed,
  className,
}: {
  cues: { part: Extract<ScriptPart, { kind: "cue" }>; number: number | null }[];
  followed: ReadonlySet<CueCategory>;
  className?: string;
}) {
  if (cues.length === 0) return null;
  return (
    <span
      className={cn(
        "my-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.85em] not-italic leading-snug",
        className,
      )}
    >
      {cues.map(({ part, number }, index) => {
        const style = CUE_STYLE[part.category];
        const labelled = part.text.toLowerCase().startsWith(style.label.toLowerCase());
        return (
          <span
            key={index}
            className={cn(
              "border-l-[3px] pl-1.5 pr-1 text-foreground",
              followed.has(part.category)
                ? style.className
                : cn(
                    style.className.split(" ").find((c) => c.startsWith("border-")),
                    "bg-transparent",
                  ),
            )}
          >
            {number ? (
              <span className={cn("mr-1 font-bold", CUE_MARK_COLOR[part.category].text)}>
                {number}
              </span>
            ) : null}
            {labelled ? (
              <span className="sr-only">{style.label}: </span>
            ) : (
              <span className="mr-1 text-[0.8em] font-bold uppercase tracking-wider opacity-60">
                {style.label}
              </span>
            )}
            {part.text}
          </span>
        );
      })}
    </span>
  );
}

export function SceneList({
  scenes,
  currentId,
  roleScenes,
  onPick,
  compact = false,
}: {
  scenes: ScriptReaderData["scenes"];
  currentId: string | undefined;
  roleScenes: ReadonlySet<string>;
  onPick: (sceneId: string) => void;
  compact?: boolean;
}) {
  return (
    <ul className={compact ? undefined : "divide-y divide-border/60"}>
      {scenes.map((scene) => (
        <li key={scene.id}>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 text-left hover:bg-muted",
              compact ? "min-h-8 px-2 py-1" : "min-h-11 gap-3 py-2 text-sm",
              scene.id === currentId && "bg-muted font-semibold",
            )}
            onClick={() => onPick(scene.id)}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0",
                roleScenes.has(scene.id) ? "bg-primary" : "bg-transparent",
              )}
              aria-label={roleScenes.has(scene.id) ? "Gewählte Rolle spielt mit" : undefined}
            />
            <span
              className={cn("min-w-0 flex-1 break-words", compact && "text-[0.8rem] leading-snug")}
            >
              {scene.title}
            </span>
            {scene.minutes ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {compact ? `${scene.minutes}′` : `ca. ${scene.minutes} min`}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
