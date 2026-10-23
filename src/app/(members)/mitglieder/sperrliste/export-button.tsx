"use client";

import { useState } from "react";
import { addDays, format, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import { toast } from "sonner";

import { FileDownIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { expandEntryDayKeys, type CalendarEntry } from "@/lib/calendar/event-kinds";
import { computeSceneReadiness, type Absence } from "@/lib/calendar/scene-readiness";
import { formatIsoTimeInTimeZone } from "@/lib/format/date";
import { buildDayInfos, type DayInfo, type FinalWeekRange } from "@/lib/sperrliste/day-tiers";
import { formatWeekdayList, sortWeekdays } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

import type { MemberGroup, SceneContext, TeamEntry, TeamMember } from "./types";

const PDF_ZONE: Record<MemberGroup, "acting" | "crew" | "both" | "unknown"> = {
  actors: "acting",
  crew: "crew",
  both: "both",
  unassigned: "unknown",
};

type ExportButtonProps = {
  members: TeamMember[];
  entries: TeamEntry[];
  holidays: HolidayRange[];
  finalWeek: FinalWeekRange;
  preferredWeekdays: number[];
  exceptionWeekdays: number[];
  calendarEntries: CalendarEntry[];
  sceneContext: SceneContext | null;
  productionTitle: string | null;
};

const firstName = (name: string) => name.split(" ")[0] ?? name;

/** Kurze Uhrzeit fürs PDF: volle Stunden ohne „:00“, z. B. „10–14“ oder „18:30“. */
function eventTime(entry: CalendarEntry) {
  if (entry.allDay) return null;
  const short = (iso: string) => formatIsoTimeInTimeZone(iso).replace(/:00$/, "");
  return entry.end && entry.end.slice(0, 10) === entry.start.slice(0, 10)
    ? `${short(entry.start)}–${short(entry.end)}`
    : short(entry.start);
}

function dayBadges(day: DayInfo) {
  const badges: { kind: "schoolHoliday" | "publicHoliday" | "finalWeek"; label: string }[] = [];
  if (day.isFinalWeek) badges.push({ kind: "finalWeek", label: "Endprobenwoche" });
  for (const holiday of day.holidays) {
    badges.push({
      kind: holiday.category === "publicHoliday" ? "publicHoliday" : "schoolHoliday",
      label: holiday.title,
    });
  }
  return badges;
}

/** Rollen der Szene mit Besetzung: „Fogg: Tom · Passepartout: Lea (Z: Jan) · Aouda: offen“. */
function describeCast(characterIds: string[], context: SceneContext, members: TeamMember[]) {
  const names = new Map(members.map((member) => [member.id, firstName(member.name)]));
  const characterNames = new Map(context.characters.map((entry) => [entry.id, entry.name]));
  const parts = characterIds.map((characterId) => {
    const castings = context.castings.filter(
      (entry) => entry.characterId === characterId && entry.type !== "cameo",
    );
    const who = (type: "primary" | "other") =>
      castings
        .filter((entry) => (type === "primary") === (entry.type === "primary"))
        .map((entry) => names.get(entry.userId) ?? "?")
        .join("/");
    const primary = who("primary");
    const other = who("other");
    const cast = primary || other ? `${primary || "–"}${other ? ` (Z: ${other})` : ""}` : "offen";
    return `${characterNames.get(characterId) ?? "Rolle"}: ${cast}`;
  });
  return parts.join(" · ") || null;
}

/** Probbarkeit jeder besetzten Szene je Tag – Grundlage sind die Sperren der Besetzung. */
function buildSceneRows(
  context: SceneContext,
  members: TeamMember[],
  days: DayInfo[],
  byMemberDay: Map<string, TeamEntry>,
) {
  const castCharacters = new Set(
    context.castings.filter((entry) => entry.type !== "cameo").map((entry) => entry.characterId),
  );
  const scenes = context.scenes.filter((scene) =>
    scene.characterIds.some((id) => castCharacters.has(id)),
  );
  const readinessContext = {
    ...context,
    scenes,
    members: members.map(({ id, name }) => ({ id, name })),
  };
  const perDay = days.map((day) => {
    const absences: Record<string, Absence> = {};
    for (const member of members) {
      const entry = byMemberDay.get(`${member.id}:${day.key}`);
      if (entry?.status === "blocked" || entry?.status === "emergency") {
        absences[member.id] = { kind: "blocked", reason: entry.reason };
      } else if (entry?.status === "limited") {
        absences[member.id] = { kind: "limited", reason: entry.reason };
      }
    }
    return computeSceneReadiness(readinessContext, absences);
  });
  const castComplete =
    context.characters.length > 0 &&
    context.characters.every((character) =>
      context.castings.some(
        (entry) => entry.characterId === character.id && entry.type === "primary",
      ),
    );
  const rows = scenes.map((scene, sceneIndex) => ({
    label: scene.label,
    cast: describeCast(scene.characterIds, context, members),
    cells: perDay.map((readiness) => {
      const entry = readiness[sceneIndex];
      const issue = entry.issues.find((item) => item.status === entry.status);
      let note: string | null = null;
      if (issue) {
        const absent = issue.absent.map((person) => firstName(person.name)).join(", ");
        note =
          issue.status === "alternate" && issue.substitute
            ? `${firstName(issue.substitute.name)} statt ${absent}`
            : issue.status === "limited"
              ? `${absent} eingeschr.`
              : `fehlt: ${absent}`;
        if (entry.issues.length > 1) note += ` +${entry.issues.length - 1}`;
      }
      return { status: entry.status, note };
    }),
  }));
  return { castComplete, rows };
}

function filenameFrom(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      console.warn("[sperrliste:export] Dateiname nicht lesbar", error);
    }
  }
  return fallback;
}

/** Probentage der nächsten zwei Wochen als PDF (gleiche Vorlage wie bisher). */
export function ExportButton({
  members,
  entries,
  holidays,
  finalWeek,
  preferredWeekdays,
  exceptionWeekdays,
  calendarEntries,
  sceneContext,
  productionTitle,
}: ExportButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    const start = startOfToday();
    const end = addDays(start, 13);
    const days = buildDayInfos(
      { start, end },
      { preferredWeekdays, exceptionWeekdays, holidays, finalWeek },
      // Nur Kerntage (Wochentage aus den Einstellungen, Endprobenwoche) – wie im PDF-Kopf
      // angegeben; Ferien, Feiertage und Termintage sind Ausnahmen und gehören nicht dazu.
    ).filter((day) => day.tier === "core");
    if (!days.length) {
      toast.info("Keine Kerntage in den nächsten zwei Wochen", { duration: 2000 });
      return;
    }

    const byMemberDay = new Map(entries.map((entry) => [`${entry.userId}:${entry.date}`, entry]));
    const eventsByDay = new Map<string, CalendarEntry[]>();
    for (const entry of calendarEntries) {
      for (const key of expandEntryDayKeys(entry)) {
        eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), entry]);
      }
    }
    const rangeLabel = `${format(start, "dd.MM.yyyy")} – ${format(end, "dd.MM.yyyy")}`;
    const important = sortWeekdays([...preferredWeekdays, ...exceptionWeekdays]);

    setBusy(true);
    try {
      const response = await fetch("/api/pdfs/sperrliste-wichtige-tage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          range: { start: start.toISOString(), end: end.toISOString(), label: rangeLabel },
          summary: {
            memberCount: members.length,
            importantWeekdays: important.length ? formatWeekdayList(important) : null,
          },
          production: productionTitle,
          days: days.map((day) => ({
            key: day.key,
            weekday: format(day.date, "EEEEEE", { locale: de }),
            date: format(day.date, "dd.MM."),
            badges: dayBadges(day),
            events: (eventsByDay.get(day.key) ?? [])
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((entry) => ({
                rehearsal: entry.kind === "REHEARSAL",
                time: eventTime(entry),
                title: entry.title,
              })),
          })),
          members: members.map((member) => ({
            zone: PDF_ZONE[member.group],
            name: member.name,
            // Rollen zuerst; wer keine hat, bekommt seine Gewerke.
            detail: (member.roles.length ? member.roles : member.departments).join(", ") || null,
            entries: days.map((day) => {
              const entry = byMemberDay.get(`${member.id}:${day.key}`);
              return entry
                ? { dayKey: day.key, status: entry.status, value: entry.reason }
                : { dayKey: day.key, status: "none", value: null };
            }),
          })),
          scenes: sceneContext ? buildSceneRows(sceneContext, members, days, byMemberDay) : null,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "PDF konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(
        response.headers.get("content-disposition"),
        `sperrliste-${format(start, "yyyyMMdd")}.pdf`,
      ).replace(/[\\/\r\n]/g, "_");
      link.click();
      URL.revokeObjectURL(url);
      toast.success("PDF heruntergeladen", { duration: 3000 });
    } catch (error) {
      console.error("[sperrliste:export]", error);
      toast.error("Export fehlgeschlagen", {
        description: error instanceof Error ? error.message : undefined,
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AsyncButton
      type="button"
      size="sm"
      variant="outline"
      isLoading={busy}
      loadingText="PDF …"
      onClick={handleExport}
      aria-label="PDF exportieren"
    >
      <FileDownIcon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">PDF</span>
    </AsyncButton>
  );
}
