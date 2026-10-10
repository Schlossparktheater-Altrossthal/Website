"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { PlusIcon } from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import { ReadinessDot } from "@/components/calendar/scene-readiness-list";
import { DEFAULT_DURATION, formatDuration, type AgendaItem } from "@/lib/calendar/agenda";
import type { AudienceContext } from "@/lib/calendar/audience";
import type { SceneReadinessStatus } from "@/lib/calendar/scene-readiness";
import { cn } from "@/lib/utils";

/** Vorlagen für häufige Programmpunkte. */
export const AGENDA_PRESETS: {
  title: string;
  durationMinutes: number;
  forEveryone: boolean;
}[] = [
  { title: "Aufwärmen", durationMinutes: 20, forEveryone: true },
  { title: "Einsingen", durationMinutes: 15, forEveryone: true },
  { title: "Pause", durationMinutes: 15, forEveryone: false },
  { title: "Durchlauf", durationMinutes: 60, forEveryone: true },
  { title: "Auswertung / Notizen", durationMinutes: 20, forEveryone: true },
];

export type QuickAddScene = {
  id: string;
  label: string;
  durationMinutes: number;
  status: SceneReadinessStatus | null;
  hint: string;
};

type Option =
  | { kind: "scene"; key: string; label: string; hint: string; scene: QuickAddScene }
  | { kind: "department"; key: string; label: string; hint: string; departmentId: string }
  | {
      kind: "preset";
      key: string;
      label: string;
      hint: string;
      preset: (typeof AGENDA_PRESETS)[number];
    }
  | { kind: "custom"; key: string; label: string; hint: string; title: string };

function blankItem(patch: Partial<AgendaItem>): AgendaItem {
  return {
    id: crypto.randomUUID(),
    type: "CUSTOM",
    sceneId: null,
    departmentId: null,
    title: "",
    location: "",
    description: "",
    durationMinutes: DEFAULT_DURATION,
    fixedStart: "",
    track: 0,
    forEveryone: false,
    timesChanged: true,
    ...patch,
  };
}

const normalize = (value: string) => value.toLocaleLowerCase("de").replace(/\s+/g, " ").trim();

/**
 * Ein Feld für alles: Szene, Gewerk, Vorlage oder freier Text. Enter legt den ersten Treffer an
 * und lässt das Feld offen für den nächsten Punkt.
 */
export function AgendaQuickAdd({
  context,
  scenes,
  onAdd,
  autoFocus = false,
  onClose,
  className,
}: {
  context: AudienceContext;
  /** Noch nicht eingeplante Szenen, nach Dringlichkeit sortiert. */
  scenes: readonly QuickAddScene[];
  onAdd: (item: AgendaItem) => void;
  autoFocus?: boolean;
  onClose?: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(autoFocus);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const options = useMemo<Option[]>(() => {
    const q = normalize(query);
    const match = (text: string) => !q || normalize(text).includes(q);
    const list: Option[] = [];
    for (const scene of scenes) {
      if (match(scene.label))
        list.push({
          kind: "scene",
          key: `s-${scene.id}`,
          label: scene.label,
          hint: scene.hint,
          scene,
        });
    }
    for (const preset of AGENDA_PRESETS) {
      if (match(preset.title))
        list.push({
          kind: "preset",
          key: `p-${preset.title}`,
          label: preset.title,
          hint: `${formatDuration(preset.durationMinutes)}${preset.forEveryone ? " · für alle" : ""}`,
          preset,
        });
    }
    if (context.hasProduction) {
      for (const department of context.departments) {
        if (match(department.name) || match(`Gewerk ${department.name}`))
          list.push({
            kind: "department",
            key: `d-${department.id}`,
            label: `Gewerk ${department.name}`,
            hint: "Gewerk wird eingeladen, die Leitung plant Details",
            departmentId: department.id,
          });
      }
    }
    if (q) {
      list.push({
        kind: "custom",
        key: "custom",
        label: `„${query.trim()}“ anlegen`,
        hint: "Sonstiger Programmpunkt",
        title: query.trim(),
      });
    }
    // Ohne Suche: Szenen zuerst, aber die Liste kurz halten.
    return q ? list.slice(0, 12) : list.slice(0, 10);
  }, [query, scenes, context]);

  const choose = (option: Option) => {
    switch (option.kind) {
      case "scene":
        onAdd(
          blankItem({
            id: `scene:${option.scene.id}`,
            type: "SCENE",
            sceneId: option.scene.id,
            durationMinutes: option.scene.durationMinutes,
          }),
        );
        break;
      case "department":
        onAdd(blankItem({ type: "DEPARTMENT", departmentId: option.departmentId }));
        break;
      case "preset":
        onAdd(
          blankItem({
            title: option.preset.title,
            durationMinutes: option.preset.durationMinutes,
            forEveryone: option.preset.forEveryone,
          }),
        );
        break;
      case "custom":
        onAdd(blankItem({ title: option.title }));
        break;
    }
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn("relative", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          onClose?.();
        }
      }}
    >
      <PlusIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Programmpunkt hinzufügen"
        placeholder="Szene, Gewerk oder Text …"
        className="h-10 pl-9"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((value) => Math.min(value + 1, options.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((value) => Math.max(value - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const option = options[active];
            if (option) choose(option);
          } else if (event.key === "Escape") {
            setOpen(false);
            onClose?.();
          }
        }}
      />
      {open && options.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li key={option.key} role="option" aria-selected={index === active}>
              <button
                type="button"
                // Klick vor dem Blur des Felds auslösen.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  index === active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                {option.kind === "scene" && option.scene.status ? (
                  <ReadinessDot status={option.scene.status} />
                ) : (
                  <span aria-hidden className="inline-block h-2 w-2 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
