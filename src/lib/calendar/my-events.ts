import type { AttendanceMark } from "@prisma/client";
import { GENERAL_EVENT_WHERE, visibleGeneralEventWhere } from "@/lib/calendar/entries";
import { getCalendarEntryKindLabel } from "@/lib/calendar/event-kinds";
import { listedEventStatus } from "@/lib/calendar/status";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { blockDayKey, isWithinFreeze, readFreezeDays } from "@/lib/calendar/block-list-link";
import { readDayAvailability } from "@/lib/calendar/day-availability";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";

/** Muss ich hin · Optional · Für alle (allgemeine Termine ohne persönliche Einladung). */
export type MyEventGroup = "required" | "optional" | "club";

/** Farbpunkt: Probe, Gewerk-Termin oder sonstiger Termin. */
export type MyEventTone = "rehearsal" | "department" | "event";

/** Abschnitt in der Übersicht. */
export type MyEventBucket = "today" | "week" | "later" | "past";

export type MyEventItem = {
  id: string;
  title: string;
  /** Kurzbezeichnung der Art, z. B. „Probe“ oder der Gewerkname. */
  label: string;
  /** Art für den Farbpunkt in der Liste. */
  tone: MyEventTone;
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
  /** Termin liegt innerhalb der Sperrfrist: eine Absage wäre ein Notfall. */
  withinFreeze: boolean;
  /** Eigene Sperrliste am Termintag: `blocked` oder `limited`, sonst `null`. */
  conflict: "blocked" | "limited" | null;
  /** Vergangene Proben: eigene Anwesenheit laut Probenmodus. */
  attendance: AttendanceMark | null;
  /** Es gibt ein Probenprotokoll. */
  hasProtocol: boolean;
  /** Warum die Person dabei ist. */
  reasons: string[];
  /** Gestaffelte Probe: Zeit der gesamten Probe, während `start`/`end` die eigene Zeit zeigen. */
  fullTime: { start: string; end: string | null } | null;
  /** Von der Planung abgesagt (mit Grund); dann ist keine eigene Absage mehr nötig. */
  cancelled: { reason: string | null } | null;
  /** Nur bei eigenen Proben: Absage möglich und ggf. schon abgesagt (mit Grund). */
  decline: {
    declined: boolean;
    note: string | null;
    tentative: boolean;
    /** Absage innerhalb der Sperrfrist – sie zählt als Notfall. */
    emergency: boolean;
  } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Proben ohne eingetragenen Ort tragen beim Anlegen diesen Platzhalter. */
const OPEN_LOCATION = "Noch offen";

/** Standard-Obergrenze je Quelle und Schrittweite für „Mehr laden". */
export const MY_EVENTS_PAGE_SIZE = 30;
/** So weit reicht der Abschnitt „Vergangen". */
const PAST_DAYS = 90;
const MAX_LIMIT = 300;

export type MyEventsOptions = {
  now?: Date;
  /** Vergangene statt kommender Termine – neueste zuerst. */
  past?: boolean;
  /** Suchbegriff über Titel und Ort. */
  search?: string;
  /** Obergrenze je Quelle; wird auf mindestens eine Seite angehoben. */
  limit?: number;
};

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

function readCancelled(event: { status: string; cancelReason: string | null }) {
  return event.status === "CANCELLED" ? { reason: event.cancelReason } : null;
}

/** Termine einer Person: eigene Proben, Gewerk-Termine und allgemeine Termine. */
export async function readMyUpcomingEvents(userId: string, options: MyEventsOptions = {}) {
  const { now = new Date(), past = false, search = "", limit = MY_EVENTS_PAGE_SIZE } = options;
  const take = Math.min(Math.max(limit, MY_EVENTS_PAGE_SIZE), MAX_LIMIT);
  const order: "asc" | "desc" = past ? "desc" : "asc";
  const startWindow = past
    ? { lt: now, gte: new Date(now.getTime() - PAST_DAYS * DAY_MS) }
    : { gte: now };
  const term = search.trim();
  const searchWhere = term
    ? {
        OR: [
          { title: { contains: term, mode: "insensitive" as const } },
          { location: { contains: term, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rehearsals, departmentEvents, generalEvents] = await Promise.all([
    prisma.eventParticipant.findMany({
      where: {
        userId,
        invited: true,
        // Jede persönliche Einladung – Probe oder anderer Termin.
        event: {
          departmentId: null,
          status: listedEventStatus,
          start: startWindow,
          ...searchWhere,
        },
      },
      orderBy: { event: { start: order } },
      take,
      select: {
        level: true,
        reasons: true,
        response: true,
        responseNote: true,
        personalStart: true,
        personalEnd: true,
        attendance: true,
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
            cancelReason: true,
            actualStart: true,
            protocolSentAt: true,
            _count: { select: { notes: true } },
          },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        start: startWindow,
        status: listedEventStatus,
        department: { memberships: { some: { userId, ...currentDepartmentMembershipWhere() } } },
        // Mit Auswahl nur für die Eingeladenen.
        ...visibleGeneralEventWhere(userId),
        ...searchWhere,
      },
      orderBy: { start: order },
      take,
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        location: true,
        status: true,
        cancelReason: true,
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
        status: listedEventStatus,
        ...(past
          ? { start: startWindow }
          : { OR: [{ start: { gte: now } }, { end: { gte: now } }] }),
        ...searchWhere,
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
      orderBy: { start: order },
      take,
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        allDay: true,
        location: true,
        status: true,
        cancelReason: true,
        show: { select: { title: true, year: true } },
        participants: {
          where: { userId },
          select: { response: true, responseNote: true },
          take: 1,
        },
      },
    }),
  ]);

  const items: Omit<MyEventItem, "bucket" | "withinFreeze" | "conflict">[] = [
    ...rehearsals.map(
      ({
        level,
        reasons,
        response,
        responseNote,
        personalStart,
        personalEnd,
        attendance,
        event,
      }) => ({
        attendance,
        hasProtocol: !!(event.actualStart || event.protocolSentAt || event._count.notes),
        id: event.id,
        title: event.title,
        label: `${getCalendarEntryKindLabel(event.kind)}${event.status === "TENTATIVE" ? " · vorgemerkt" : ""}`,
        tone: event.kind === "REHEARSAL" ? ("rehearsal" as const) : ("event" as const),
        start: (personalStart ?? event.start).toISOString(),
        end: (personalEnd ?? event.end)?.toISOString() ?? null,
        fullTime: personalStart
          ? { start: event.start.toISOString(), end: event.end?.toISOString() ?? null }
          : null,
        allDay: event.allDay,
        ...readLocation(event.location),
        href: `/mitglieder/termine/${event.id}`,
        group: level === "OPTIONAL" ? ("optional" as const) : ("required" as const),
        reasons: Array.isArray(reasons) ? reasons.filter((entry) => typeof entry === "string") : [],
        cancelled: readCancelled(event),
        decline:
          event.status === "CANCELLED"
            ? null
            : {
                declined: response === "no" || response === "emergency",
                note: responseNote,
                tentative: event.status === "TENTATIVE",
                emergency: response === "emergency",
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
        tone: "department" as const,
        start: event.start.toISOString(),
        end: event.end?.toISOString() ?? null,
        allDay: false,
        ...readLocation(event.location),
        href: `/mitglieder/termine/${event.id}`,
        group: guest ? ("optional" as const) : ("required" as const),
        reasons: [
          guest ? `Gast im Gewerk ${event.department.name}` : `Gewerk ${event.department.name}`,
        ],
        fullTime: null,
        attendance: null,
        hasProtocol: false,
        cancelled: readCancelled(event),
        decline: null,
      };
    }),
    // Ohne eigene Einladung: Termin für alle (Eingeladene stehen oben mit Absage).
    ...generalEvents.map((event) => {
      const own = event.participants[0] ?? null;
      const response = own?.response ?? null;
      return {
        id: event.id,
        title: event.title,
        label: event.show ? (event.show.title ?? String(event.show.year)) : "Allgemein",
        tone: "event" as const,
        start: event.start.toISOString(),
        end: event.end?.toISOString() ?? null,
        allDay: event.allDay,
        ...readLocation(event.location),
        href: `/mitglieder/termine/${event.id}`,
        group: "club" as const,
        reasons: [event.show ? "Termin deiner Produktion" : "Termin für alle"],
        fullTime: null,
        attendance: null,
        hasProtocol: false,
        cancelled: readCancelled(event),
        decline:
          event.status === "CANCELLED"
            ? null
            : {
                declined: response === "no" || response === "emergency",
                note: own?.responseNote ?? null,
                tentative: event.status === "TENTATIVE",
                emergency: response === "emergency",
              },
      };
    }),
  ];

  const freezeDays = await readFreezeDays();
  // Sperrliste je Termintag einmal laden, statt pro Termin.
  const dayKeys = [...new Set(items.map((item) => blockDayKey(new Date(item.start))))];
  const availability = new Map(
    await Promise.all(dayKeys.map(async (key) => [key, await readDayAvailability(key)] as const)),
  );

  return items
    .map((item) => ({
      ...item,
      bucket: resolveEventBucket(new Date(item.start), now),
      withinFreeze: isWithinFreeze(new Date(item.start), freezeDays, now),
      conflict: item.cancelled
        ? null
        : (availability.get(blockDayKey(new Date(item.start)))?.[userId] ?? null),
    }))
    .sort((a, b) => (past ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
}

/**
 * Der nächste kommende Termin – unabhängig von Ansicht und Filtern, für das Widget in der rechten
 * Spalte. Nutzt dieselbe Sichtbarkeitslogik wie die Übersicht.
 */
export async function readNextEvent(userId: string, now = new Date()) {
  const items = await readMyUpcomingEvents(userId, { now });
  return items.find((item) => !item.cancelled) ?? null;
}
