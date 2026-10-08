import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";
import { visibleEventStatus } from "@/lib/calendar/status";
import {
  computeWeekLoad,
  shiftDayKey,
  weekBounds,
  type PersonLoad,
} from "@/lib/calendar/week-load";
import { prisma } from "@/lib/prisma";

/** Einschränkung laut Sperrliste an einem Tag (nur wer gesperrt oder eingeschränkt ist). */
export type DayAvailability = Partial<Record<string, "blocked" | "limited">>;

/** Sperrliste eines Kalendertags (yyyy-MM-dd, Europe/Berlin). */
export async function readDayAvailability(dateKey: string): Promise<DayAvailability> {
  const dayStart = parseDateTimeInTimeZone(dateKey, "00:00", DEFAULT_TIME_ZONE);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const entries = await prisma.blockedDay.findMany({
    where: { date: { gte: dayStart, lt: dayEnd }, kind: { in: ["BLOCKED", "LIMITED"] } },
    select: { userId: true, kind: true },
  });
  return Object.fromEntries(
    entries.map((entry) => [entry.userId, entry.kind === "BLOCKED" ? "blocked" : "limited"]),
  );
}

/** Wer im Zeitraum schon zu einer anderen angesetzten Probe eingeladen ist (Person → Titel). */
export async function readParallelRehearsals({
  start,
  end,
  excludeEventId,
}: {
  start: Date;
  end: Date;
  excludeEventId: string;
}): Promise<Partial<Record<string, string>>> {
  const participants = await prisma.eventParticipant.findMany({
    where: {
      invited: true,
      response: { notIn: ["no", "emergency"] },
      event: {
        id: { not: excludeEventId },
        departmentId: null,
        status: visibleEventStatus,
        start: { lt: end },
        end: { gt: start },
      },
    },
    select: { userId: true, event: { select: { title: true } } },
  });
  return Object.fromEntries(participants.map((entry) => [entry.userId, entry.event.title]));
}

/**
 * Wer in der Kalenderwoche von `dateKey` schon zu wie vielen Terminen eingeladen ist (ohne
 * Absagen und ohne den Termin selbst) – für „diese Woche schon 2×“ in der Teilnehmerliste.
 */
export async function readWeekLoad(
  dateKey: string,
  excludeEventId?: string,
): Promise<Record<string, PersonLoad>> {
  const { from, to } = weekBounds(dateKey);
  const weekStart = parseDateTimeInTimeZone(from, "00:00", DEFAULT_TIME_ZONE);
  const weekEnd = parseDateTimeInTimeZone(shiftDayKey(to, 1), "00:00", DEFAULT_TIME_ZONE);
  const events = await prisma.calendarEvent.findMany({
    where: {
      status: visibleEventStatus,
      start: { gte: weekStart, lt: weekEnd },
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    },
    select: {
      id: true,
      start: true,
      end: true,
      participants: {
        where: { invited: true, response: { notIn: ["no", "emergency"] } },
        select: { userId: true },
      },
    },
  });
  return computeWeekLoad(
    events.map((event) => ({
      id: event.id,
      dayKey: formatIsoDateInTimeZone(event.start.toISOString(), DEFAULT_TIME_ZONE),
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      userIds: event.participants.map((entry) => entry.userId),
    })),
    dateKey,
  );
}
