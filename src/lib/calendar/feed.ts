import { randomBytes } from "node:crypto";

import type { BlockedDayKind } from "@prisma/client";

import { getAppBaseUrl } from "@/lib/app-url";
import { buildIcsCalendar, type IcsEvent } from "@/lib/calendar/ics";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { currentMembershipWhere } from "@/lib/produktionen/status";

/** Wie weit der Feed zurück- und vorausreicht. */
const PAST_DAYS = 60;
const FUTURE_DAYS = 550;
/** Probe/Termin ohne Ende: so lange zeigen, damit der Kalender einen Block anzeigt. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
/** Abrufzeitpunkt nur gelegentlich schreiben – Kalender pollen oft. */
const ACCESS_WRITE_INTERVAL_MS = 15 * 60 * 1000;
const PREFIX = "🎭 ";

const BLOCKED_DAY_LABELS: Record<BlockedDayKind, string> = {
  BLOCKED: "Gesperrt",
  LIMITED: "Eingeschränkt",
  PREFERRED: "Bevorzugt",
};

export function generateFeedToken() {
  return randomBytes(32).toString("base64url");
}

/** Token aus dem Pfadsegment, mit oder ohne `.ics`. */
export function parseFeedToken(segment: string) {
  const token = segment.replace(/\.ics$/i, "");
  return /^[A-Za-z0-9_-]{32,64}$/.test(token) ? token : null;
}

export function buildFeedUrl(token: string) {
  return `${getAppBaseUrl()}/api/calendar/feed/${token}.ics`;
}

function dayKey(date: Date) {
  return formatIsoDateInTimeZone(date.toISOString());
}

function nextDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
}

function timedEnd(start: Date, end: Date | null) {
  return end && end.getTime() > start.getTime()
    ? end
    : new Date(start.getTime() + DEFAULT_DURATION_MS);
}

function withLink(description: string | null, path: string) {
  const link = `${getAppBaseUrl()}${path}`;
  return description?.trim() ? `${description.trim()}\n\n${link}` : link;
}

function uidHost() {
  try {
    return new URL(getAppBaseUrl()).host;
  } catch {
    return "mitgliederbereich";
  }
}

/**
 * Alle Termine, die die Person betreffen: Proben mit Einladung, Termine ihrer Produktionen und
 * allgemeine Termine, Termine ihrer Gewerke – optional die eigenen Sperren.
 */
export async function collectFeedEvents(
  userId: string,
  { includeBlockedDays }: { includeBlockedDays: boolean },
  now: Date = new Date(),
): Promise<IcsEvent[]> {
  const from = new Date(now.getTime() - PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 86_400_000);
  const host = uidHost();

  const [rehearsals, calendarEvents, departmentEvents, blockedDays] = await Promise.all([
    prisma.rehearsal.findMany({
      where: {
        start: { gte: from, lte: to },
        status: { not: "DRAFT" },
        invitees: { some: { userId } },
      },
      orderBy: { start: "asc" },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        location: true,
        description: true,
        status: true,
        updatedAt: true,
        show: { select: { title: true } },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        start: { lte: to },
        AND: [
          { OR: [{ start: { gte: from } }, { end: { gte: from } }] },
          {
            OR: [
              { showId: null },
              { show: { memberships: { some: { userId, ...currentMembershipWhere(now) } } } },
            ],
          },
        ],
      },
      orderBy: { start: "asc" },
    }),
    prisma.departmentEvent.findMany({
      where: {
        start: { gte: from, lte: to },
        department: { memberships: { some: { userId } } },
      },
      orderBy: { start: "asc" },
      include: { department: { select: { name: true } } },
    }),
    includeBlockedDays
      ? prisma.blockedDay.findMany({
          where: { userId, date: { gte: from, lte: to } },
          orderBy: { date: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const events: IcsEvent[] = [];

  for (const rehearsal of rehearsals) {
    const location =
      rehearsal.location && rehearsal.location !== "Noch offen" ? rehearsal.location : null;
    events.push({
      uid: `rehearsal-${rehearsal.id}@${host}`,
      summary: `${PREFIX}${rehearsal.title}`,
      start: { kind: "dateTime", value: rehearsal.start },
      end: { kind: "dateTime", value: timedEnd(rehearsal.start, rehearsal.end) },
      location,
      description: withLink(
        [rehearsal.show?.title, rehearsal.description].filter(Boolean).join("\n\n") || null,
        `/mitglieder/proben/${rehearsal.id}`,
      ),
      cancelled: rehearsal.status === "CANCELLED",
      lastModified: rehearsal.updatedAt,
    });
  }

  for (const event of calendarEvents) {
    const base = {
      uid: `event-${event.id}@${host}`,
      summary: `${PREFIX}${event.title}`,
      location: event.location,
      description: withLink(event.description, "/mitglieder/sperrliste"),
      lastModified: event.updatedAt,
    };
    if (event.allDay) {
      const endKey = dayKey(event.end ?? event.start);
      events.push({
        ...base,
        start: { kind: "date", value: dayKey(event.start) },
        end: { kind: "date", value: nextDayKey(endKey) },
      });
    } else {
      events.push({
        ...base,
        start: { kind: "dateTime", value: event.start },
        end: { kind: "dateTime", value: timedEnd(event.start, event.end) },
      });
    }
  }

  for (const event of departmentEvents) {
    events.push({
      uid: `department-event-${event.id}@${host}`,
      summary: `${PREFIX}${event.title} (${event.department.name})`,
      start: { kind: "dateTime", value: event.start },
      end: { kind: "dateTime", value: timedEnd(event.start, event.end) },
      location: event.location,
      description: withLink(event.description, "/mitglieder/meine-proben"),
      lastModified: event.updatedAt,
    });
  }

  for (const day of blockedDays) {
    const key = dayKey(day.date);
    events.push({
      uid: `blocked-day-${day.id}@${host}`,
      summary: `${PREFIX}${BLOCKED_DAY_LABELS[day.kind]}`,
      start: { kind: "date", value: key },
      end: { kind: "date", value: nextDayKey(key) },
      description: withLink(day.reason, "/mitglieder/sperrliste"),
      // Eigene Sperren sind eine Notiz, keine belegte Zeit.
      transparent: true,
      lastModified: day.updatedAt,
    });
  }

  return events;
}

/** Feed zum Token als ICS-Text, `null` wenn unbekannt oder die Person deaktiviert ist. */
export async function renderCalendarFeed(token: string, now: Date = new Date()) {
  const feed = await prisma.calendarFeed.findUnique({
    where: { token },
    include: { user: { select: { id: true, deactivatedAt: true } } },
  });
  if (!feed || feed.user.deactivatedAt) return null;

  const events = await collectFeedEvents(
    feed.userId,
    { includeBlockedDays: feed.includeBlockedDays },
    now,
  );

  if (
    !feed.lastAccessedAt ||
    now.getTime() - feed.lastAccessedAt.getTime() > ACCESS_WRITE_INTERVAL_MS
  ) {
    await prisma.calendarFeed
      .update({ where: { id: feed.id }, data: { lastAccessedAt: now } })
      .catch((error) => console.warn("[calendar-feed] Abrufzeit nicht gespeichert", error));
  }

  return buildIcsCalendar({
    name: "Theater – Meine Termine",
    description: "Proben und Termine aus dem Mitgliederbereich",
    events,
    now,
  });
}
