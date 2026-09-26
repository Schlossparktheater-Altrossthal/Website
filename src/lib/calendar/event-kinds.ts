import type { CalendarEventKind } from "@prisma/client";

import { formatIsoDateInTimeZone } from "@/lib/date-time";

export const CALENDAR_EVENT_KINDS = [
  "PERFORMANCE",
  "MEETING",
  "WORK_DAY",
  "SOCIAL",
  "OTHER",
] as const satisfies readonly CalendarEventKind[];

export const CALENDAR_EVENT_KIND_LABELS: Record<CalendarEventKind, string> = {
  PERFORMANCE: "Vorstellung",
  MEETING: "Treffen",
  WORK_DAY: "Arbeitseinsatz",
  SOCIAL: "Geselliges",
  OTHER: "Sonstiges",
};

/** Ein Eintrag im Kalender – Termin der Organisation oder Probe. */
export type CalendarEntry = {
  id: string;
  source: "event" | "rehearsal";
  kind: CalendarEventKind | "REHEARSAL";
  title: string;
  /** ISO-Zeitpunkte. */
  start: string;
  end: string | null;
  allDay: boolean;
  /** Kalendertag in Europe/Berlin (yyyy-MM-dd). */
  dayKey: string;
  location: string | null;
  description: string | null;
  href: string | null;
  /** Produktion des Eintrags; null = gilt für alle Produktionen. */
  showId?: string | null;
};

export function getCalendarEntryKindLabel(kind: CalendarEntry["kind"]) {
  return kind === "REHEARSAL" ? "Probe" : CALENDAR_EVENT_KIND_LABELS[kind];
}

/** Tage (yyyy-MM-dd), die ein Eintrag belegt – mehrtägige Termine zählen für jeden Tag. */
export function expandEntryDayKeys(entry: Pick<CalendarEntry, "start" | "end" | "dayKey">) {
  if (!entry.end) return [entry.dayKey];
  const last = formatIsoDateInTimeZone(entry.end);
  const keys: string[] = [];
  const cursor = new Date(`${entry.dayKey}T12:00:00Z`);
  for (let guard = 0; guard < 60; guard += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (key > last) break;
    keys.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys.length ? keys : [entry.dayKey];
}
