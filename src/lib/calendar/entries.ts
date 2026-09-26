import type { CalendarEvent } from "@prisma/client";

import type { CalendarEntry } from "@/lib/calendar/event-kinds";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

/** `showId`: nur Einträge dieser Produktion und allgemeine ohne Produktion. */
type Range = { from: Date; to: Date; showId?: string | null };

function showScope(showId: string | null | undefined) {
  return showId ? { OR: [{ showId }, { showId: null }] } : {};
}

function toDayKey(date: Date) {
  return formatIsoDateInTimeZone(date.toISOString());
}

/** Termine der Organisation im Zeitraum (Beginn innerhalb oder mehrtägig überlappend). */
export async function readCalendarEvents({ from, to, showId }: Range): Promise<CalendarEntry[]> {
  const events = await prisma.calendarEvent.findMany({
    where: {
      start: { lte: to },
      AND: [{ OR: [{ start: { gte: from } }, { end: { gte: from } }] }, showScope(showId)],
    },
    orderBy: { start: "asc" },
  });
  return events.map(toCalendarEntry);
}

export async function readCalendarEventById(id: string) {
  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  return event ? toCalendarEntry(event) : null;
}

function toCalendarEntry(event: CalendarEvent): CalendarEntry {
  return {
    id: event.id,
    source: "event",
    kind: event.kind,
    title: event.title,
    start: event.start.toISOString(),
    end: event.end?.toISOString() ?? null,
    allDay: event.allDay,
    dayKey: toDayKey(event.start),
    location: event.location,
    description: event.description,
    href: null,
    showId: event.showId,
  };
}

/** Angesetzte Proben im Zeitraum (ohne Entwürfe und Absagen). */
export async function readRehearsalEntries({ from, to, showId }: Range): Promise<CalendarEntry[]> {
  const rehearsals = await prisma.rehearsal.findMany({
    where: {
      start: { gte: from, lte: to },
      status: { notIn: ["DRAFT", "CANCELLED"] },
      ...showScope(showId),
    },
    orderBy: { start: "asc" },
    select: {
      id: true,
      title: true,
      start: true,
      end: true,
      location: true,
      description: true,
      showId: true,
    },
  });
  return rehearsals.map((rehearsal) => ({
    id: rehearsal.id,
    source: "rehearsal",
    kind: "REHEARSAL",
    title: rehearsal.title,
    start: rehearsal.start.toISOString(),
    end: rehearsal.end.toISOString(),
    allDay: false,
    dayKey: toDayKey(rehearsal.start),
    location: rehearsal.location || null,
    description: rehearsal.description,
    href: "/mitglieder/meine-proben",
    showId: rehearsal.showId,
  }));
}

export async function readCalendarEntries(range: Range) {
  const [events, rehearsals] = await Promise.all([
    readCalendarEvents(range),
    readRehearsalEntries(range),
  ]);
  return [...events, ...rehearsals].sort((a, b) => a.start.localeCompare(b.start));
}
