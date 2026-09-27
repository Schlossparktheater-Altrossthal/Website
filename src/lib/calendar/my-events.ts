import { GENERAL_EVENT_WHERE, visibleGeneralEventWhere } from "@/lib/calendar/entries";
import { getCalendarEntryKindLabel } from "@/lib/calendar/event-kinds";
import { visibleEventStatus } from "@/lib/calendar/status";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";

/** Muss ich hin · Optional · Für alle (allgemeine Termine ohne persönliche Einladung). */
export type MyEventGroup = "required" | "optional" | "club";

/** Abschnitt in der Übersicht. */
export type MyEventBucket = "today" | "week" | "later" | "past";

export type MyEventItem = {
  id: string;
  title: string;
  /** Kurzbezeichnung der Art, z. B. „Probe“ oder der Gewerkname. */
  label: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  /** Ort steht laut Planung noch nicht fest („Noch offen"). */
  locationOpen: boolean;
  href: string | null;
  group: MyEventGroup;
  /** Abschnitt: heute & morgen, Rest der Woche, später oder vergangen. */
  bucket: MyEventBucket;
  /** Warum die Person dabei ist. */
  reasons: string[];
  /** Gestaffelte Probe: Zeit der gesamten Probe, während `start`/`end` die eigene Zeit zeigen. */
  fullTime: { start: string; end: string | null } | null;
  /** Nur bei eigenen Proben: Absage möglich und ggf. schon abgesagt (mit Grund). */
  decline: { declined: boolean; note: string | null; tentative: boolean } | null;
};

const TAKE = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Proben ohne eingetragenen Ort tragen beim Anlegen diesen Platzhalter. */
const OPEN_LOCATION = "Noch offen";

/**
 * Ordnet einen Termin einem Abschnitt zu. Gerechnet wird auf Tagesebene in `Europe/Berlin`,
 * damit Server und Browser denselben Abschnitt sehen.
 */
export function resolveEventBucket(start: Date, now: Date = new Date()): MyEventBucket {
  const startKey = formatIsoDateInTimeZone(start.toISOString());
  const [year, month, day] = formatIsoDateInTimeZone(now.toISOString()).split("-").map(Number);
  const todayUtc = Date.UTC(year, month - 1, day);
  const keyAt = (offsetDays: number) =>
    new Date(todayUtc + offsetDays * DAY_MS).toISOString().slice(0, 10);

  if (startKey < keyAt(0)) return "past";
  if (startKey <= keyAt(1)) return "today";
  // Rest der laufenden Woche bis einschließlich Sonntag. Am Sonntag ist die Woche vorbei; dann
  // reicht der Abschnitt bis zum kommenden Sonntag, sonst stünde alles unter „Später".
  const daysUntilSunday = (7 - new Date(todayUtc).getUTCDay()) % 7;
  return startKey <= keyAt(daysUntilSunday === 0 ? 7 : daysUntilSunday) ? "week" : "later";
}

/** Ort und Hinweis „noch offen“ getrennt, damit die Oberfläche keinen Platzhalter anzeigt. */
function readLocation(value: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return { location: null, locationOpen: false };
  if (text === OPEN_LOCATION) return { location: null, locationOpen: true };
  return { location: text, locationOpen: false };
}

/** Kommende Termine einer Person: eigene Proben, Gewerk-Termine und allgemeine Termine. */
export async function readMyUpcomingEvents(userId: string, now = new Date()) {
  const [rehearsals, departmentEvents, generalEvents] = await Promise.all([
    prisma.eventParticipant.findMany({
      where: {
        userId,
        invited: true,
        // Jede persönliche Einladung – Probe oder anderer Termin.
        event: { departmentId: null, status: visibleEventStatus, start: { gte: now } },
      },
      orderBy: { event: { start: "asc" } },
      take: TAKE,
      select: {
        level: true,
        reasons: true,
        response: true,
        responseNote: true,
        personalStart: true,
        personalEnd: true,
        event: {
          select: {
            id: true,
            title: true,
            kind: true,
            start: true,
            end: true,
            allDay: true,
            location: true,
            status: true,
          },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        start: { gte: now },
        status: visibleEventStatus,
        department: { memberships: { some: { userId, ...currentDepartmentMembershipWhere() } } },
        // Mit Auswahl nur für die Eingeladenen.
        ...visibleGeneralEventWhere(userId),
      },
      orderBy: { start: "asc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        location: true,
        department: {
          select: {
            name: true,
            slug: true,
            memberships: { where: { userId }, select: { role: true } },
          },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        ...GENERAL_EVENT_WHERE,
        status: visibleEventStatus,
        OR: [{ start: { gte: now } }, { end: { gte: now } }],
        AND: [
          {
            OR: [
              { showId: null },
              { show: { memberships: { some: { userId, ...currentMembershipWhere(now) } } } },
            ],
          },
          visibleGeneralEventWhere(userId),
          { participants: { none: { userId, invited: true } } },
        ],
      },
      orderBy: { start: "asc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        allDay: true,
        location: true,
        show: { select: { title: true, year: true } },
      },
    }),
  ]);

  const items: Omit<MyEventItem, "bucket">[] = [
    ...rehearsals.map(
      ({ level, reasons, response, responseNote, personalStart, personalEnd, event }) => ({
        id: event.id,
        title: event.title,
        label: `${getCalendarEntryKindLabel(event.kind)}${event.status === "TENTATIVE" ? " · vorgemerkt" : ""}`,
        start: (personalStart ?? event.start).toISOString(),
        end: (personalEnd ?? event.end)?.toISOString() ?? null,
        fullTime: personalStart
          ? { start: event.start.toISOString(), end: event.end?.toISOString() ?? null }
          : null,
        allDay: event.allDay,
        ...readLocation(event.location),
        href: `/mitglieder/proben/${event.id}`,
        group: level === "OPTIONAL" ? ("optional" as const) : ("required" as const),
        reasons: Array.isArray(reasons) ? reasons.filter((entry) => typeof entry === "string") : [],
        decline: {
          declined: response === "no" || response === "emergency",
          note: responseNote,
          tentative: event.status === "TENTATIVE",
        },
      }),
    ),
    ...departmentEvents.flatMap((event) => {
      if (!event.department) return [];
      const guest = event.department.memberships[0]?.role === "guest";
      return {
        id: event.id,
        title: event.title,
        label: event.department.name,
        start: event.start.toISOString(),
        end: event.end?.toISOString() ?? null,
        allDay: false,
        ...readLocation(event.location),
        href: `/mitglieder/meine-gewerke/${event.department.slug}?ansicht=termine`,
        group: guest ? ("optional" as const) : ("required" as const),
        reasons: [
          guest ? `Gast im Gewerk ${event.department.name}` : `Gewerk ${event.department.name}`,
        ],
        fullTime: null,
        decline: null,
      };
    }),
    // Ohne eigene Einladung: Termin für alle (Eingeladene stehen oben mit Absage).
    ...generalEvents.map((event) => ({
      id: event.id,
      title: event.title,
      label: event.show ? (event.show.title ?? String(event.show.year)) : "Allgemein",
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      allDay: event.allDay,
      ...readLocation(event.location),
      href: null,
      group: "club" as const,
      reasons: [event.show ? "Termin deiner Produktion" : "Termin für alle"],
      fullTime: null,
      decline: null,
    })),
  ];

  return items
    .map((item) => ({ ...item, bucket: resolveEventBucket(new Date(item.start), now) }))
    .sort((a, b) => a.start.localeCompare(b.start));
}
