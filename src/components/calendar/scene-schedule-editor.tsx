"use client";

import { useMemo } from "react";

import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeInput } from "@/components/ui/time-input";
import type { AudienceContext } from "@/lib/calendar/audience";
import { scenesByPerson } from "@/lib/calendar/scene-schedule";

export type SceneScheduleValue = {
  mode: "TOGETHER" | "STAGGERED";
  times: Record<string, { start: string; end: string }>;
  /** Raum pro Szene (bei parallelen Bausteinen). */
  rooms: Record<string, string>;
};

export type SceneStatsView = Record<
  string,
  { rehearsed: number; lastRehearsedAt: string | null; planned: number }
>;

const MODE_OPTIONS = [
  { value: "TOGETHER" as const, label: "Alle zur Terminzeit" },
  { value: "STAGGERED" as const, label: "Uhrzeit pro Szene" },
];

const SHORT_DATE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});

function describeStats(stats: SceneStatsView[string] | undefined) {
  if (!stats || (!stats.rehearsed && !stats.planned)) return "noch nie geprobt";
  const parts = [`${stats.rehearsed}× geprobt`];
  if (stats.lastRehearsedAt)
    parts.push(`zuletzt ${SHORT_DATE.format(new Date(stats.lastRehearsedAt))}`);
  if (stats.planned) parts.push(`${stats.planned}× angesetzt`);
  return parts.join(" · ");
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function toTime(minutes: number) {
  const value = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** Szenen einer Probe wählen, sortieren und optional mit Uhrzeiten versehen. */
export function SceneScheduleEditor({
  context,
  sceneIds,
  onScenesChange,
  schedule,
  onScheduleChange,
  stats,
  eventStartTime,
  invitedIds,
}: {
  context: AudienceContext;
  sceneIds: string[];
  onScenesChange: (sceneIds: string[]) => void;
  schedule: SceneScheduleValue;
  onScheduleChange: (schedule: SceneScheduleValue) => void;
  stats: SceneStatsView;
  /** Beginn der Probe (HH:MM) für den Zeitvorschlag. */
  eventStartTime: string;
  /** Nur diese Personen erscheinen in der Vorschau (eingeladen, nicht ausgenommen). */
  invitedIds: ReadonlySet<string>;
}) {
  const scenes = sceneIds.flatMap((id) => context.scenes.find((scene) => scene.id === id) ?? []);
  const available = context.scenes.filter((scene) => !sceneIds.includes(scene.id));
  const staggered = schedule.mode === "STAGGERED";

  const move = (index: number, offset: number) => {
    const next = [...sceneIds];
    const [entry] = next.splice(index, 1);
    if (!entry) return;
    next.splice(index + offset, 0, entry);
    onScenesChange(next);
  };

  const setTime = (sceneId: string, field: "start" | "end", value: string) => {
    const current = schedule.times[sceneId] ?? { start: "", end: "" };
    onScheduleChange({
      ...schedule,
      times: { ...schedule.times, [sceneId]: { ...current, [field]: value } },
    });
  };

  /** Szenen nacheinander ab Probenbeginn; Dauer aus dem Stück, sonst 30 Minuten. */
  const suggestTimes = () => {
    let cursor = toMinutes(eventStartTime);
    const times: SceneScheduleValue["times"] = {};
    for (const scene of scenes) {
      const duration =
        scene.durationMinutes && scene.durationMinutes > 0 ? scene.durationMinutes : 30;
      times[scene.id] = { start: toTime(cursor), end: toTime(cursor + duration) };
      cursor += duration;
    }
    onScheduleChange({ ...schedule, times });
  };

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {available.length ? (
          <Select value="" onValueChange={(id) => onScenesChange([...sceneIds, id])}>
            <SelectTrigger className="h-11 w-full sm:h-9 sm:w-72" aria-label="Szene hinzufügen">
              <SelectValue placeholder="+ Szene hinzufügen" />
            </SelectTrigger>
            <SelectContent>
              {available.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  {scene.label} · {describeStats(stats[scene.id])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span />
        )}
        {scenes.length ? (
          <SegmentedControl
            value={schedule.mode}
            onValueChange={(mode) => onScheduleChange({ ...schedule, mode })}
            options={MODE_OPTIONS}
            fullWidth
            className="sm:w-auto"
            aria-label="Ablauf der Probe"
          />
        ) : null}
      </div>

      {scenes.length ? (
        <ol className="divide-y divide-border rounded-lg border border-border">
          {scenes.map((scene, index) => (
            <li key={scene.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{scene.label}</p>
                <p className="text-xs text-muted-foreground">{describeStats(stats[scene.id])}</p>
              </div>
              {staggered ? (
                <div className="flex items-center gap-2 sm:w-auto">
                  <TimeInput
                    value={schedule.times[scene.id]?.start ?? ""}
                    onChange={(event) => setTime(scene.id, "start", event.target.value)}
                    aria-label={`Beginn ${scene.label}`}
                    className="flex-1 sm:w-28 sm:flex-none"
                  />
                  <span className="text-muted-foreground">–</span>
                  <TimeInput
                    value={schedule.times[scene.id]?.end ?? ""}
                    onChange={(event) => setTime(scene.id, "end", event.target.value)}
                    aria-label={`Ende ${scene.label}`}
                    className="flex-1 sm:w-28 sm:flex-none"
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
                    className="h-9 flex-1 sm:w-32 sm:flex-none"
                  />
                </div>
              ) : null}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`${scene.label} nach oben`}
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  disabled={index === scenes.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`${scene.label} nach unten`}
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => onScenesChange(sceneIds.filter((id) => id !== scene.id))}
                  aria-label={`${scene.label} entfernen`}
                >
                  <CloseIcon className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Noch keine Szenen. Die Besetzung gewählter Szenen wird automatisch eingeladen.
        </div>
      )}

      {staggered && scenes.length ? (
        <div className="space-y-3">
          <Button type="button" variant="outline" size="sm" onClick={suggestTimes}>
            Zeiten ab {eventStartTime || "Probenbeginn"} vorschlagen
          </Button>
          {personalPreview.length ? (
            <details className="rounded-lg bg-muted p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Wer kommt wann? ({personalPreview.length})
              </summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {personalPreview.map((entry) => (
                  <li key={entry.userId}>
                    <span className="font-medium text-foreground">{entry.name}:</span>{" "}
                    {entry.window} (Sz. {entry.scenes})
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Wer in keiner Szene mit Uhrzeit spielt, kommt zur Terminzeit.
          </p>
        </div>
      ) : null}
    </div>
  );
}
