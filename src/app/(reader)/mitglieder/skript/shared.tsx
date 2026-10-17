"use client";

import * as React from "react";

import { SCRIPT_CUE_STYLES } from "@/config/category-colors";
import type { ScriptReaderData } from "@/lib/skript/reader";
import {
  DEFAULT_SCRIPT_VIEW,
  pickView,
  sanitizeViewPatch,
  type ReaderState,
  type ScriptView,
} from "@/lib/skript/view-options";
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

/**
 * Leser-Einstellungen = Ansicht (was Leser und PDF zeigen, docs/Plan/skript-ansicht-plan.md)
 * + eigene Rollen + Geräteeinstellungen (bleiben nur auf diesem Gerät).
 */
export type Settings = ScriptView & {
  roleIds: string[];
  keepAwake: boolean;
  /** Probenmodus: Werte vor dem Einschalten, damit Ausschalten sie zurückholt (null = aus). */
  rehearsalBackup: Pick<Settings, "fontSize" | "keepAwake" | "dimOthers"> | null;
};

const DEFAULT_SETTINGS: Omit<Settings, "roleIds"> = {
  ...DEFAULT_SCRIPT_VIEW,
  keepAwake: true,
  rehearsalBackup: null,
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

type StoredSettings = Partial<Settings> & { savedAt?: number };

/**
 * Einstellungen je Stück: im Browser (sofort, offline) und – mit `server` – pro Person auf dem
 * Server, damit Handy und Laptop gleich aussehen. Der neuere Stand gewinnt.
 */
export function useSettings(
  showId: string,
  ownRoleIds: string[],
  server?: {
    state: ReaderState | null;
    save: (showId: string, state: ReaderState) => Promise<unknown>;
  },
) {
  const key = `skript-leser:${showId}`;
  const [settings, setSettings] = React.useState<Settings>({
    ...DEFAULT_SETTINGS,
    roleIds: ownRoleIds,
  });
  const loaded = React.useRef(false);
  const saveTimer = React.useRef<number | null>(null);
  const serverRef = React.useRef(server);
  React.useEffect(() => {
    serverRef.current = server;
  });
  const push = React.useCallback(
    (next: Settings, savedAt: number) => {
      const save = serverRef.current?.save;
      if (!save) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void save(showId, { view: pickView(next), roleIds: next.roleIds, savedAt }).catch(
          (error: unknown) => console.warn("Leser-Stand nicht auf dem Server gespeichert", error),
        );
      }, 1200);
    },
    [showId],
  );
  React.useEffect(() => {
    const stored = readStored<StoredSettings>(key);
    const remote = serverRef.current?.state ?? null;
    const localAt = stored?.savedAt ?? 0;
    const useRemote = remote && remote.savedAt > localAt;
    // Geräteeinstellungen kommen immer aus dem Browser.
    const device = {
      ...(typeof stored?.keepAwake === "boolean" ? { keepAwake: stored.keepAwake } : {}),
      ...(stored?.rehearsalBackup !== undefined
        ? { rehearsalBackup: stored.rehearsalBackup ?? null }
        : {}),
    };
    const source = useRemote
      ? { view: remote.view, roleIds: remote.roleIds }
      : stored
        ? {
            view: sanitizeViewPatch(stored),
            roleIds: Array.isArray(stored.roleIds) ? stored.roleIds : undefined,
          }
        : null;
    if (source) {
      setSettings((current) => {
        const next = {
          ...current,
          ...source.view,
          ...(source.roleIds ? { roleIds: source.roleIds } : {}),
          ...device,
        };
        if (useRemote) writeStored(key, { ...next, savedAt: remote.savedAt });
        // Älterer Stand auf dem Server (z. B. erst offline geändert): nachziehen.
        else if (stored && localAt > (remote?.savedAt ?? 0)) push(next, localAt);
        return next;
      });
    }
    loaded.current = true;
  }, [key, push]);
  React.useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    [],
  );
  const update = React.useCallback(
    (patch: Partial<Settings>) =>
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (loaded.current) {
          const savedAt = Date.now();
          writeStored(key, { ...next, savedAt });
          const device = Object.keys(patch).every(
            (name) => name === "keepAwake" || name === "rehearsalBackup",
          );
          if (!device) push(next, savedAt);
        }
        return next;
      }),
    [key, push],
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
