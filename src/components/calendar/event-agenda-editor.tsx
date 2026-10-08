"use client";

import { useMemo, useState } from "react";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  MoreVerticalIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TimeInput } from "@/components/ui/time-input";
import {
  ReadinessHint,
  ReadinessSummary,
  SceneReadinessList,
} from "@/components/calendar/scene-readiness-list";
import type { AudienceContext } from "@/lib/calendar/audience";
import { READINESS_LABEL, type SceneReadiness } from "@/lib/calendar/scene-readiness";
import { scenesByPerson } from "@/lib/calendar/scene-schedule";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

export type SceneScheduleValue = {
  mode: "TOGETHER" | "STAGGERED";
  times: Record<string, { start: string; end: string }>;
  /** Raum pro Szene (bei parallelen Programmpunkten). */
  rooms: Record<string, string>;
};

export type SceneStatsView = Record<
  string,
  { rehearsed: number; lastRehearsedAt: string | null; planned: number }
>;

/** Weiterer Programmpunkt (Datenmodell `EventBlock`): Gewerk-Arbeit oder Sonstiges. */
export type EventBlockValue = {
  id: string;
  type: "DEPARTMENT" | "CUSTOM";
  title: string;
  departmentId: string | null;
  start: string;
  end: string;
  location: string;
  description: string;
  /** Zeiten hier geändert (sonst behält Gewerk-Arbeit die Zeiten der Gewerk-Leitung). */
  timesChanged: boolean;
};

const DAY_LABEL = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});

const SHORT_DATE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

function describeSceneStats(stats: SceneStatsView[string] | undefined) {
  if (!stats || (!stats.rehearsed && !stats.planned)) return "noch nie geprobt";
  const parts = [`${stats.rehearsed}× geprobt`];
  if (stats.lastRehearsedAt)
    parts.push(`zuletzt ${SHORT_DATE.format(new Date(stats.lastRehearsedAt))}`);
  if (stats.planned) parts.push(`${stats.planned}× angesetzt`);
  return parts.join(" · ");
}

function describeSceneOption(
  readiness: SceneReadiness | undefined,
  stats: SceneStatsView[string] | undefined,
) {
  const statsText = describeSceneStats(stats);
  return readiness ? `${READINESS_LABEL[readiness.status]} · ${statsText}` : statsText;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function toTime(minutes: number) {
  const value = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** Szenen nacheinander ab Beginn; Dauer aus dem Stück, sonst 30 Minuten. */
function suggestSceneTimes(
  scenes: readonly { id: string; durationMinutes?: number | null }[],
  startTime: string,
) {
  let cursor = toMinutes(startTime);
  const times: SceneScheduleValue["times"] = {};
  for (const scene of scenes) {
    const duration =
      scene.durationMinutes && scene.durationMinutes > 0 ? scene.durationMinutes : 30;
    times[scene.id] = { start: toTime(cursor), end: toTime(cursor + duration) };
    cursor += duration;
  }
  return times;
}

function newBlock(type: EventBlockValue["type"], departmentId: string | null = null) {
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    departmentId,
    start: "",
    end: "",
    location: "",
    description: "",
    timesChanged: true,
  } satisfies EventBlockValue;
}

/** Farbstreifen links: Szene, Gewerk, Sonstiges. */
const STRIPE = {
  scene: "bg-info",
  department: "bg-primary",
  custom: "bg-muted-foreground/50",
} as const;

type RowActionsProps = {
  label: string;
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
};

/** Sortieren und Entfernen hinter einem Menü – spart pro Zeile zwei Knöpfe. */
function RowActions({ label, onUp, onDown, onRemove }: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          aria-label={`Aktionen für ${label}`}
        >
          <MoreVerticalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onUp ? (
          <DropdownMenuItem onSelect={onUp}>
            <ChevronUpIcon className="h-4 w-4" /> Nach oben
          </DropdownMenuItem>
        ) : null}
        {onDown ? (
          <DropdownMenuItem onSelect={onDown}>
            <ChevronDownIcon className="h-4 w-4" /> Nach unten
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
          <TrashIcon className="h-4 w-4" /> Entfernen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TimeRange({
  label,
  start,
  end,
  onStart,
  onEnd,
}: {
  label: string;
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
      <TimeInput
        value={start}
        onChange={(event) => onStart(event.target.value)}
        aria-label={`Beginn ${label}`}
        className="h-9 min-w-0 flex-1 sm:w-28 sm:flex-none"
      />
      <span className="text-muted-foreground">–</span>
      <TimeInput
        value={end}
        onChange={(event) => onEnd(event.target.value)}
        aria-label={`Ende ${label}`}
        className="h-9 min-w-0 flex-1 sm:w-28 sm:flex-none"
      />
    </div>
  );
}

/**
 * Ablauf eines Termins als eine Liste: Szenen, Gewerk-Arbeit und sonstige Programmpunkte.
 * Programmpunkte dürfen parallel in eigenen Räumen laufen.
 */
export function EventAgendaEditor({
  context,
  sceneIds,
  onScenesChange,
  schedule,
  onScheduleChange,
  stats,
  blocks,
  onBlocksChange,
  eventStartTime,
  invitedIds,
  readiness,
  dateKey,
}: {
  context: AudienceContext;
  sceneIds: string[];
  onScenesChange: (sceneIds: string[]) => void;
  schedule: SceneScheduleValue;
  onScheduleChange: (schedule: SceneScheduleValue) => void;
  stats: SceneStatsView;
  blocks: EventBlockValue[];
  onBlocksChange: (blocks: EventBlockValue[]) => void;
  /** Beginn des Termins (HH:MM) für den Zeitvorschlag. */
  eventStartTime: string;
  /** Nur diese Personen erscheinen in „Wer kommt wann?“. */
  invitedIds: ReadonlySet<string>;
  /** Probbarkeit aller Szenen am Termintag. */
  readiness: readonly SceneReadiness[];
  /** Termintag (yyyy-MM-dd). */
  dateKey: string;
}) {
  const readinessById = useMemo(
    () => new Map(readiness.map((entry) => [entry.sceneId, entry])),
    [readiness],
  );
  // Ohne Szenen gleich aufgeklappt: dann ist „was geht heute?“ die erste Frage.
  const [readinessOpen, setReadinessOpen] = useState(sceneIds.length === 0);
  const dayLabel = dateKey ? DAY_LABEL.format(new Date(`${dateKey}T12:00:00Z`)) : "diesem Tag";
  const scenes = sceneIds.flatMap((id) => context.scenes.find((scene) => scene.id === id) ?? []);
  const availableScenes = context.scenes.filter((scene) => !sceneIds.includes(scene.id));
  const staggered = schedule.mode === "STAGGERED";
  const departmentName = (id: string | null) =>
    context.departments.find((entry) => entry.id === id)?.name ?? "Gewerk";

  const moveScene = (index: number, offset: number) => {
    const next = [...sceneIds];
    const [entry] = next.splice(index, 1);
    if (!entry) return;
    next.splice(index + offset, 0, entry);
    onScenesChange(next);
  };
  const moveBlock = (index: number, offset: number) => {
    const next = [...blocks];
    const [entry] = next.splice(index, 1);
    if (!entry) return;
    next.splice(index + offset, 0, entry);
    onBlocksChange(next);
  };
  const setSceneTime = (sceneId: string, field: "start" | "end", value: string) => {
    const current = schedule.times[sceneId] ?? { start: "", end: "" };
    onScheduleChange({
      ...schedule,
      times: { ...schedule.times, [sceneId]: { ...current, [field]: value } },
    });
  };
  const updateBlock = (id: string, patch: Partial<EventBlockValue>) =>
    onBlocksChange(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)));

  const personalPreview = useMemo(() => {
    if (!staggered) return [];
    const names = new Map(context.members.map((member) => [member.id, member.name]));
    const labels = new Map(context.scenes.map((scene) => [scene.id, scene.label]));
    return Array.from(scenesByPerson(sceneIds, context), ([userId, ids]) => {
      if (!invitedIds.has(userId)) return null;
      const timed = ids.flatMap((id) => {
        const time = schedule.times[id];
        return time?.start && time.end ? [{ id, ...time }] : [];
      });
      if (!timed.length) return null;
      const start = timed.map((entry) => entry.start).sort()[0];
      const end = timed
        .map((entry) => entry.end)
        .sort()
        .at(-1);
      return {
        userId,
        name: names.get(userId) ?? "Unbekannt",
        window: `${start}–${end}`,
        scenes: timed.map((entry) => labels.get(entry.id)?.split(" ")[1] ?? "").join(", "),
      };
    })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.window.localeCompare(b.window) || a.name.localeCompare(b.name, "de"));
  }, [staggered, sceneIds, schedule.times, context, invitedIds]);

  const isEmpty = !scenes.length && !blocks.length;

  const addMenu = (
    <ChoiceMenu
      title="Programmpunkt hinzufügen"
      trigger={
        <Button type="button" variant="outline" size="sm" className="h-10 sm:h-9">
          <PlusIcon className="h-4 w-4" aria-hidden />
          Programmpunkt
        </Button>
      }
      entries={[
        ...(context.scenes.length
          ? [
              {
                id: "scene",
                label: "Szene proben",
                hint: "Die Besetzung wird eingeladen",
                items: availableScenes.map((scene) => ({
                  id: scene.id,
                  label: scene.label,
                  hint: describeSceneOption(readinessById.get(scene.id), stats[scene.id]),
                })),
                onSelect: (id?: string) => {
                  if (id) onScenesChange([...sceneIds, id]);
                },
              },
            ]
          : []),
        ...(context.departments.length
          ? [
              {
                id: "department",
                label: "Gewerk arbeitet",
                hint: "Das Gewerk wird eingeladen, die Leitung plant Details",
                items: context.departments.map((department) => ({
                  id: department.id,
                  label: department.name,
                })),
                onSelect: (id?: string) => {
                  if (id) onBlocksChange([...blocks, newBlock("DEPARTMENT", id)]);
                },
              },
            ]
          : []),
        {
          id: "custom",
          label: "Sonstiges",
          hint: "z. B. Einsingen, Besprechung",
          onSelect: () => onBlocksChange([...blocks, newBlock("CUSTOM")]),
        },
      ]}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {scenes.length ? (
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <Switch
              checked={staggered}
              onCheckedChange={(value) =>
                onScheduleChange({ ...schedule, mode: value ? "STAGGERED" : "TOGETHER" })
              }
            />
            Szenen mit eigener Uhrzeit
          </label>
        ) : (
          <span className="text-sm text-muted-foreground">
            {isEmpty ? "Noch kein Ablauf." : null}
          </span>
        )}
        {addMenu}
      </div>

      {!isEmpty ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {scenes.map((scene, index) => (
            <li key={scene.id} className="flex gap-3 py-2 pl-2 pr-1">
              <span aria-hidden className={cn("w-1 shrink-0 rounded-full", STRIPE.scene)} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex min-h-9 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{scene.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Szene · {describeSceneStats(stats[scene.id])}
                    </p>
                    <ReadinessHint entry={readinessById.get(scene.id)} />
                  </div>
                  {staggered ? (
                    <div className="hidden items-center gap-2 md:flex">
                      <TimeRange
                        label={scene.label}
                        start={schedule.times[scene.id]?.start ?? ""}
                        end={schedule.times[scene.id]?.end ?? ""}
                        onStart={(value) => setSceneTime(scene.id, "start", value)}
                        onEnd={(value) => setSceneTime(scene.id, "end", value)}
                      />
                      <Input
                        value={schedule.rooms[scene.id] ?? ""}
                        onChange={(event) =>
                          onScheduleChange({
                            ...schedule,
                            rooms: { ...schedule.rooms, [scene.id]: event.target.value },
                          })
                        }
                        placeholder="Raum"
                        maxLength={120}
                        aria-label={`Raum ${scene.label}`}
                        className="h-9 w-28"
                      />
                    </div>
                  ) : null}
                  <RowActions
                    label={scene.label}
                    onUp={index > 0 ? () => moveScene(index, -1) : undefined}
                    onDown={index < scenes.length - 1 ? () => moveScene(index, 1) : undefined}
                    onRemove={() => onScenesChange(sceneIds.filter((id) => id !== scene.id))}
                  />
                </div>
                {staggered ? (
                  <div className="flex items-center gap-2 pr-2 md:hidden">
                    <TimeRange
                      label={scene.label}
                      start={schedule.times[scene.id]?.start ?? ""}
                      end={schedule.times[scene.id]?.end ?? ""}
                      onStart={(value) => setSceneTime(scene.id, "start", value)}
                      onEnd={(value) => setSceneTime(scene.id, "end", value)}
                    />
                    <Input
                      value={schedule.rooms[scene.id] ?? ""}
                      onChange={(event) =>
                        onScheduleChange({
                          ...schedule,
                          rooms: { ...schedule.rooms, [scene.id]: event.target.value },
                        })
                      }
                      placeholder="Raum"
                      maxLength={120}
                      aria-label={`Raum ${scene.label} (mobil)`}
                      className="h-9 w-20 shrink-0"
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
          {blocks.map((block, index) => {
            const isDepartment = block.type === "DEPARTMENT";
            const kindLabel = isDepartment ? departmentName(block.departmentId) : "Sonstiges";
            const label = block.title || kindLabel;
            return (
              <li key={block.id} className="flex gap-3 py-2 pl-2 pr-1">
                <span
                  aria-hidden
                  className={cn(
                    "w-1 shrink-0 rounded-full",
                    isDepartment ? STRIPE.department : STRIPE.custom,
                  )}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={block.title}
                      onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                      placeholder={
                        isDepartment ? "Was steht an? z. B. Podeste bauen" : "z. B. Einsingen"
                      }
                      maxLength={120}
                      aria-label={`Titel ${kindLabel}`}
                      className="h-9 min-w-0 flex-1"
                    />
                    <RowActions
                      label={label}
                      onUp={index > 0 ? () => moveBlock(index, -1) : undefined}
                      onDown={index < blocks.length - 1 ? () => moveBlock(index, 1) : undefined}
                      onRemove={() =>
                        onBlocksChange(blocks.filter((entry) => entry.id !== block.id))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pr-2">
                    <TimeRange
                      label={label}
                      start={block.start}
                      end={block.end}
                      onStart={(value) =>
                        updateBlock(block.id, { start: value, timesChanged: true })
                      }
                      onEnd={(value) => updateBlock(block.id, { end: value, timesChanged: true })}
                    />
                    {isDepartment ? null : (
                      <Input
                        value={block.location}
                        onChange={(event) =>
                          updateBlock(block.id, { location: event.target.value })
                        }
                        placeholder="Raum"
                        maxLength={120}
                        aria-label={`Raum ${label}`}
                        className="h-9 w-20 shrink-0 sm:w-32"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isDepartment
                      ? `Gewerk ${kindLabel} ist eingeladen${block.location ? ` · Raum: ${block.location}` : ""} · Details plant die Gewerk-Leitung`
                      : "Sonstiger Programmpunkt"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {readiness.length ? (
        <details
          open={readinessOpen}
          onToggle={(event) => setReadinessOpen(event.currentTarget.open)}
          className="group rounded-lg bg-muted px-3 py-2 text-sm"
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">Am {dayLabel} probbar:</span>
            <span className="text-xs text-muted-foreground">
              <ReadinessSummary entries={readiness} />
            </span>
            <ChevronDownIcon
              aria-hidden
              className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <SceneReadinessList
            className="mt-3"
            entries={readiness}
            selectedIds={sceneIds}
            onAdd={(id) => onScenesChange([...sceneIds, id])}
          />
        </details>
      ) : null}

      {staggered && scenes.length ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="-ml-2"
            onClick={() =>
              onScheduleChange({
                ...schedule,
                times: suggestSceneTimes(scenes, eventStartTime),
              })
            }
          >
            Zeiten ab {eventStartTime || "Beginn"} vorschlagen
          </Button>
          <span>Wer in keiner Szene mit Uhrzeit spielt, kommt zur Terminzeit.</span>
        </div>
      ) : null}
      {staggered && personalPreview.length ? (
        <details className="rounded-lg bg-muted px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">
            Wer kommt wann? ({personalPreview.length})
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {personalPreview.map((entry) => (
              <li key={entry.userId}>
                <span className="font-medium text-foreground">{entry.name}:</span> {entry.window}{" "}
                (Sz. {entry.scenes})
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
