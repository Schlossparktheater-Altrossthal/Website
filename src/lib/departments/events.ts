import type { BlockedDayKind } from "@prisma/client";

import { toEventResponseStatus, type EventResponseStatus } from "@/lib/calendar/responses";

import { formatIsoDateInTimeZone, formatIsoTimeInTimeZone } from "@/lib/date-time";
import { getNameInitials, getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

/** Wie weit Sperren der Mitglieder für die Terminplanung geladen werden. */
const BLOCK_LOOKAHEAD_DAYS = 365;
const PAST_EVENTS = 10;

export type EventPerson = { id: string; name: string; initials: string };

export type EventBlock = { userId: string; name: string; kind: BlockedDayKind };

export type TeamEvent = {
  id: string;
  title: string;
  /** ISO-Zeitpunkte. */
  start: string;
  end: string | null;
  /** `YYYY-MM-DD` und `HH:mm` in Berliner Zeit, für Anzeige und Formular. */
  dayKey: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  description: string | null;
  past: boolean;
  myResponse: EventResponseStatus | null;
  responses: { person: EventPerson; status: EventResponseStatus }[];
  /** Aktive Mitglieder ohne Antwort. */
  pending: EventPerson[];
  /** Mitglieder, die an dem Tag in der Sperrliste gesperrt oder eingeschränkt sind. */
  blocked: EventBlock[];
  /** Nur diese Mitglieder sind eingeladen; null = ganzes Team. */
  invitedIds: string[] | null;
  /** Gemeinsamer Termin, zu dem das Gewerk eingeladen ist; wird woanders geplant. */
  shared: boolean;
  /** Probe: Absage nur mit Begründung in „Meine Termine“. */
  rehearsal: boolean;
  /** Ob die Person hier zu- oder absagen kann (Proben laufen über „Meine Termine“). */
  respondable: boolean;
};

export type TeamEventsData = {
  departmentId: string;
  today: string;
  upcoming: TeamEvent[];
  past: TeamEvent[];
  /** Sperren der Mitglieder je Tag (`YYYY-MM-DD`), für die Warnung beim Anlegen. */
  blocksByDay: Record<string, EventBlock[]>;
  /** Aktive Mitglieder, für die Auswahl beim Anlegen. */
  members: EventPerson[];
};

const toPerson = (user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
}): EventPerson => ({
  id: user.id,
  name: getUserDisplayName(user),
  initials: getNameInitials(user),
});

const userSelect = { id: true, firstName: true, lastName: true, name: true, email: true } as const;

/** Termine eines Gewerks mit Zusagen, offenen Antworten und Sperren der Mitglieder. */
export async function loadTeamEvents(departmentId: string, viewerId: string, now = new Date()) {
  const today = formatIsoDateInTimeZone(now.toISOString());
  const startOfToday = new Date(`${today}T00:00:00.000Z`);
  const blockUntil = new Date(startOfToday.getTime() + BLOCK_LOOKAHEAD_DAYS * 86_400_000);

  const eventSelect = {
    id: true,
    title: true,
    start: true,
    end: true,
    location: true,
    description: true,
    kind: true,
    departmentId: true,
    participants: {
      where: { NOT: { response: null, invited: false } },
      select: { response: true, invited: true, user: { select: userSelect } },
    },
  } as const;

  // Eigene Termine plus angesetzte gemeinsame Termine, zu denen das Gewerk eingeladen ist.
  const ownOrInvited = {
    OR: [
      { departmentId },
      {
        departmentId: null,
        status: "SCHEDULED" as const,
        audienceRules: { some: { type: "DEPARTMENT" as const, targetId: departmentId } },
      },
    ],
  };

  const [members, upcoming, past, blockedDays] = await Promise.all([
    prisma.departmentMembership.findMany({
      where: { departmentId, status: "active", user: { deactivatedAt: null } },
      select: { user: { select: userSelect } },
    }),
    prisma.calendarEvent.findMany({
      where: {
        AND: [ownOrInvited, { OR: [{ start: { gte: now } }, { end: { gte: now } }] }],
      },
      orderBy: { start: "asc" },
      select: eventSelect,
    }),
    prisma.calendarEvent.findMany({
      where: {
        AND: [ownOrInvited, { start: { lt: now } }, { OR: [{ end: null }, { end: { lt: now } }] }],
      },
      orderBy: { start: "desc" },
      take: PAST_EVENTS,
      select: eventSelect,
    }),
    prisma.blockedDay.findMany({
      where: {
        date: { gte: startOfToday, lte: blockUntil },
        kind: { in: ["BLOCKED", "LIMITED"] },
        user: {
          deactivatedAt: null,
          departmentMemberships: { some: { departmentId, status: "active" } },
        },
      },
      select: { date: true, kind: true, user: { select: userSelect } },
    }),
  ]);

  const people = members.map((entry) => toPerson(entry.user));
  const blocksByDay: Record<string, EventBlock[]> = {};
  for (const day of blockedDays) {
    const key = day.date.toISOString().slice(0, 10);
    (blocksByDay[key] ??= []).push({
      userId: day.user.id,
      name: getUserDisplayName(day.user),
      kind: day.kind,
    });
  }

  const memberIds = new Set(people.map((person) => person.id));

  const toEvent = (event: (typeof upcoming)[number], isPast: boolean): TeamEvent => {
    const dayKey = formatIsoDateInTimeZone(event.start.toISOString());
    const shared = event.departmentId !== departmentId;
    // Bei gemeinsamen Terminen zählen nur die Mitglieder dieses Gewerks.
    const participants = shared
      ? event.participants.filter((entry) => memberIds.has(entry.user.id))
      : event.participants;
    const responses = participants
      .flatMap((entry) =>
        entry.response
          ? [{ person: toPerson(entry.user), status: toEventResponseStatus(entry.response) }]
          : [],
      )
      .sort((a, b) => a.person.name.localeCompare(b.person.name, "de"));
    const invited = participants.filter((entry) => entry.invited);
    const invitedIds = invited.length || shared ? invited.map((entry) => entry.user.id) : null;
    const expected = invitedIds
      ? people.filter((person) => invitedIds.includes(person.id))
      : people;
    return {
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      dayKey,
      startTime: formatIsoTimeInTimeZone(event.start.toISOString()),
      endTime: event.end ? formatIsoTimeInTimeZone(event.end.toISOString()) : null,
      location: event.location,
      description: event.description,
      past: isPast,
      myResponse: responses.find((entry) => entry.person.id === viewerId)?.status ?? null,
      responses,
      pending: expected.filter(
        (person) => !responses.some((entry) => entry.person.id === person.id),
      ),
      blocked: (blocksByDay[dayKey] ?? []).filter(
        (block) => !invitedIds || invitedIds.includes(block.userId),
      ),
      invitedIds,
      shared,
      rehearsal: event.kind === "REHEARSAL",
      respondable:
        event.kind !== "REHEARSAL" &&
        (!shared || invited.some((entry) => entry.user.id === viewerId)),
    };
  };

  return {
    departmentId,
    today,
    upcoming: upcoming.map((event) => toEvent(event, false)),
    past: past.map((event) => toEvent(event, true)),
    blocksByDay,
    members: [...people].sort((a, b) => a.name.localeCompare(b.name, "de")),
  } satisfies TeamEventsData;
}
