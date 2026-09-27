import type { DayAvailability } from "@/lib/calendar/day-availability";
import type { FinderDay } from "@/lib/calendar/date-finder";
import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";
import { visibleEventStatus } from "@/lib/calendar/status";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Zeitfenster eines Tages; ein Ende vor dem Beginn liegt am Folgetag. */
function dayWindow(dateKey: string, startTime: string, endTime: string) {
  const start = parseDateTimeInTimeZone(dateKey, startTime, DEFAULT_TIME_ZONE);
  let end = parseDateTimeInTimeZone(dateKey, endTime, DEFAULT_TIME_ZONE);
  if (end <= start) end = new Date(end.getTime() + DAY_MS);
  return { start, end };
}

/**
 * Sperrliste und belegte Zeiten der Personen für die Kandidatentage. Belegt ist, wer im
 * Zeitfenster zu einem anderen angesetzten Termin eingeladen ist oder zu einem Gewerk gehört,
 * das dann einen Termin hat (ohne Absage).
 */
export async function loadFinderDays({
  userIds,
  dateKeys,
  startTime,
  endTime,
}: {
  userIds: readonly string[];
  dateKeys: readonly string[];
  startTime: string;
  endTime: string;
}): Promise<FinderDay[]> {
  if (!dateKeys.length) return [];
  const sorted = [...dateKeys].sort();
  const rangeStart = parseDateTimeInTimeZone(sorted[0]!, "00:00", DEFAULT_TIME_ZONE);
  const rangeEnd = new Date(
    parseDateTimeInTimeZone(sorted.at(-1)!, "00:00", DEFAULT_TIME_ZONE).getTime() + 2 * DAY_MS,
  );
  const users = [...userIds];

  const [blocks, events] = await Promise.all([
    prisma.blockedDay.findMany({
      where: {
        userId: { in: users },
        date: { gte: rangeStart, lt: rangeEnd },
        kind: { in: ["BLOCKED", "LIMITED"] },
      },
      select: { userId: true, kind: true, date: true },
    }),
    prisma.calendarEvent.findMany({
      where: {
        status: visibleEventStatus,
        start: { lt: rangeEnd },
        OR: [{ end: { gt: rangeStart } }, { end: null, start: { gte: rangeStart } }],
      },
      select: {
        title: true,
        start: true,
        end: true,
        participants: {
          where: { userId: { in: users } },
          select: { userId: true, invited: true, response: true },
        },
        department: {
          select: {
            memberships: {
              where: { status: "active", userId: { in: users } },
              select: { userId: true },
            },
          },
        },
      },
    }),
  ]);

  const blocksByDay = new Map<string, DayAvailability>();
  for (const entry of blocks) {
    const key = formatIsoDateInTimeZone(entry.date.toISOString(), DEFAULT_TIME_ZONE);
    const day = blocksByDay.get(key) ?? {};
    // Gesperrt schlägt eingeschränkt.
    if (day[entry.userId] !== "blocked") {
      day[entry.userId] = entry.kind === "BLOCKED" ? "blocked" : "limited";
    }
    blocksByDay.set(key, day);
  }

  const busyPeople = events.map((event) => {
    const declined = new Set(
      event.participants
        .filter((entry) => entry.response === "no" || entry.response === "emergency")
        .map((entry) => entry.userId),
    );
    // Mit Einladungen zählen nur die Eingeladenen, sonst das ganze Gewerk.
    const invited = event.participants.filter((entry) => entry.invited).map((e) => e.userId);
    const people = new Set(
      invited.length ? invited : (event.department?.memberships.map((entry) => entry.userId) ?? []),
    );
    return {
      title: event.title,
      start: event.start,
      end: event.end ?? new Date(event.start.getTime() + 60 * 60 * 1000),
      userIds: [...people].filter((userId) => !declined.has(userId)),
    };
  });

  return dateKeys.map((dateKey) => {
    const window = dayWindow(dateKey, startTime, endTime);
    const busy: Partial<Record<string, string>> = {};
    for (const event of busyPeople) {
      if (event.start >= window.end || event.end <= window.start) continue;
      for (const userId of event.userIds) busy[userId] ??= event.title;
    }
    return { dateKey, blocks: blocksByDay.get(dateKey) ?? {}, busy };
  });
}
