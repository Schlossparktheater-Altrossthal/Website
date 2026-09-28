import type { CalendarEvent, Prisma } from "@prisma/client";

import type { CalendarEntry } from "@/lib/calendar/event-kinds";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { visibleEventStatus } from "@/lib/calendar/status";
import { prisma } from "@/lib/prisma";

/**
 * Allgemeine Termine für Mitglieder: vorgemerkt oder angesetzt, ohne Gewerk-Termine
 * (Gewerk-Portal) und ohne Proben (eigene Einladung mit Zu-/Absage, siehe `readRehearsalEntries`).
 */
export const GENERAL_EVENT_WHERE = {
  departmentId: null,
  kind: { not: "REHEARSAL" },
  status: visibleEventStatus,
} satisfies Prisma.CalendarEventWhereInput;

/**
 * Allgemeine Termine, die eine Person sieht: ohne Zielgruppe gelten sie für alle, mit
 * Zielgruppe nur für die Eingeladenen.
 */
export function visibleGeneralEventWhere(userId: string) {
  return {
    OR: [
      { audienceRules: { none: {} }, participants: { none: { invited: true } } },
      { participants: { some: { userId, invited: true } } },
    ],
  } satisfies Prisma.CalendarEventWhereInput;
}

/**
 * `showId`: nur Einträge dieser Produktion und allgemeine ohne Produktion.
 * `viewerId`: nur Termine, die diese Person sieht (ohne Angabe alle, für die Planung).
 */
type Range = { from: Date; to: Date; showId?: string | null; viewerId?: string };

function showScope(showId: string | null | undefined) {
  return showId ? { OR: [{ showId }, { showId: null }] } : {};
}

function toDayKey(date: Date) {
  return formatIsoDateInTimeZone(date.toISOString());
}

/** Termine der Organisation im Zeitraum (Beginn innerhalb oder mehrtägig überlappend). */
export async function readCalendarEvents({
  from,
  to,
  showId,
  viewerId,
}: Range): Promise<CalendarEntry[]> {
  const events = await prisma.calendarEvent.findMany({
    where: {
      start: { lte: to },
      ...GENERAL_EVENT_WHERE,
      AND: [
        { OR: [{ start: { gte: from } }, { end: { gte: from } }] },
        showScope(showId),
        viewerId ? visibleGeneralEventWhere(viewerId) : {},
      ],
    },
    orderBy: { start: "asc" },
  });
  return events.map(toCalendarEntry);
}

function toCalendarEntry(event: CalendarEvent): CalendarEntry {
  return {
    id: event.id,
    source: "event",
    kind: event.kind,
    title: event.status === "TENTATIVE" ? `${event.title} (vorgemerkt)` : event.title,
    start: event.start.toISOString(),
    end: event.end?.toISOString() ?? null,
    allDay: event.allDay,
    dayKey: toDayKey(event.start),
    location: event.location,
    description: event.description,
    href: `/mitglieder/termine/${event.id}`,
    showId: event.showId,
  };
}

/** Vorgemerkte und angesetzte Proben im Zeitraum (ohne Entwürfe und Absagen). */
export async function readRehearsalEntries({ from, to, showId }: Range): Promise<CalendarEntry[]> {
  const rehearsals = await prisma.calendarEvent.findMany({
    where: {
      kind: "REHEARSAL",
      start: { gte: from, lte: to },
      status: visibleEventStatus,
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
      status: true,
    },
  });
  return rehearsals.map((rehearsal) => ({
    id: rehearsal.id,
    source: "rehearsal",
    kind: "REHEARSAL",
    title: rehearsal.status === "TENTATIVE" ? `${rehearsal.title} (vorgemerkt)` : rehearsal.title,
    start: rehearsal.start.toISOString(),
    end: (rehearsal.end ?? rehearsal.start).toISOString(),
    allDay: false,
    dayKey: toDayKey(rehearsal.start),
    location: rehearsal.location || null,
    description: rehearsal.description,
    href: `/mitglieder/termine/${rehearsal.id}`,
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
