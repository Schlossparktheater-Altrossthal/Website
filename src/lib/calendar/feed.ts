import { randomBytes } from "node:crypto";

import type { BlockedDayKind, FeedScope } from "@prisma/client";

import { getAppBaseUrl } from "@/lib/app-url";
import { buildIcsCalendar, type IcsEvent } from "@/lib/calendar/ics";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { GENERAL_EVENT_WHERE } from "@/lib/calendar/entries";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";

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

function describeParticipation(participants: { reasons: unknown }[]) {
  const [participant] = participants;
  if (!participant) return "Du bist für diese Probe nicht eingeladen.";
  const reasons = Array.isArray(participant.reasons)
    ? participant.reasons.filter((entry): entry is string => typeof entry === "string")
    : [];
  return reasons.length ? `Dabei als: ${reasons.join(" · ")}` : null;
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
  { includeBlockedDays, scope = "MINE" }: { includeBlockedDays: boolean; scope?: FeedScope },
  now: Date = new Date(),
): Promise<IcsEvent[]> {
  const from = new Date(now.getTime() - PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 86_400_000);
  const host = uidHost();

  const [rehearsals, calendarEvents, departmentEvents, blockedDays] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        kind: "REHEARSAL",
        start: { gte: from, lte: to },
        status: { not: "DRAFT" },
        OR: [
          { participants: { some: { userId, invited: true } } },
          // „Alles aus meinen Produktionen“: auch Proben ohne eigene Einladung.
          ...(scope === "PRODUCTIONS"
            ? [{ show: { memberships: { some: { userId, ...currentMembershipWhere(now) } } } }]
            : []),
        ],
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
        participants: { where: { userId, invited: true }, select: { reasons: true } },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        start: { lte: to },
        ...GENERAL_EVENT_WHERE,
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
    prisma.calendarEvent.findMany({
      where: {
        start: { gte: from, lte: to },
        department: { memberships: { some: { userId, ...currentDepartmentMembershipWhere() } } },
        // Abgesagte Termine tauchen im eigenen Kalender nicht mehr auf.
        participants: { none: { userId, response: { in: ["no", "emergency"] } } },
      },
      orderBy: { start: "asc" },
      include: { department: { select: { name: true, slug: true } } },
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
        [
          rehearsal.show?.title,
          describeParticipation(rehearsal.participants),
          rehearsal.description,
        ]
          .filter(Boolean)
          .join("\n\n") || null,
        `/mitglieder/proben/${rehearsal.id}`,
      ),
      // Nicht eingeladen: nur zur Info, belegt keine Zeit.
      transparent: rehearsal.participants.length === 0,
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
      summary: `${PREFIX}${event.title} (${event.department?.name ?? "Gewerk"})`,
      start: { kind: "dateTime", value: event.start },
      end: { kind: "dateTime", value: timedEnd(event.start, event.end) },
      location: event.location,
      description: withLink(
        event.description,
        `/mitglieder/meine-gewerke/${event.department?.slug ?? ""}?ansicht=termine`,
      ),
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
    { includeBlockedDays: feed.includeBlockedDays, scope: feed.scope },
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
