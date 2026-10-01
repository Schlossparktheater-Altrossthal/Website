import type { CalendarEvent, Prisma } from "@prisma/client";

import type { CalendarEntry } from "@/lib/calendar/event-kinds";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { visibleEventStatus } from "@/lib/calendar/status";
import { currentMembershipWhere } from "@/lib/produktionen/status";
import { prisma } from "@/lib/prisma";

/**
 * Termine für Mitglieder: vorgemerkt oder angesetzt, ohne Gewerk-Termine (Gewerk-Portal).
 * Die Art (Probe, Treffen …) ist nur ein Etikett und spielt hier keine Rolle.
 */
export const GENERAL_EVENT_WHERE = {
  departmentId: null,
  status: visibleEventStatus,
} satisfies Prisma.CalendarEventWhereInput;

/** Ohne Zielgruppe gilt ein Termin für alle (der Produktion bzw. alle Mitglieder). */
export const OPEN_EVENT_WHERE = {
  audienceRules: { none: {} },
  participants: { none: { invited: true } },
} satisfies Prisma.CalendarEventWhereInput;

/** Termine, die eine Person betreffen: offen für alle oder mit eigener Einladung. */
export function visibleGeneralEventWhere(userId: string) {
  return {
    OR: [OPEN_EVENT_WHERE, { participants: { some: { userId, invited: true } } }],
  } satisfies Prisma.CalendarEventWhereInput;
}

/**
 * Termine, die eine Person im Kalender sieht: was sie betrifft, plus alle Termine ihrer
 * Produktionen (wie die Terminseite). Offene Termine einer Produktion nur für deren Mitglieder.
 */
export function viewableEventWhere(userId: string, now = new Date()) {
  const member = {
    show: { memberships: { some: { userId, ...currentMembershipWhere(now) } } },
  } satisfies Prisma.CalendarEventWhereInput;
  return {
    OR: [
      { participants: { some: { userId, invited: true } } },
      { showId: null, ...OPEN_EVENT_WHERE },
      member,
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
        viewerId ? viewableEventWhere(viewerId) : {},
      ],
    },
    orderBy: { start: "asc" },
  });
  return events.map(toCalendarEntry);
}

function toCalendarEntry(event: CalendarEvent): CalendarEntry {
  return {
    id: event.id,
    source: event.kind === "REHEARSAL" ? "rehearsal" : "event",
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

/** Alle Termine im Zeitraum – Proben und andere Arten gleich behandelt. */
export async function readCalendarEntries(range: Range) {
  return readCalendarEvents(range);
}
