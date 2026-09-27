import type { ParticipationLevel } from "@prisma/client";

import type { DayAvailability } from "@/lib/calendar/day-availability";

/**
 * Terminfinder: bewertet Kalendertage danach, wie viele Teilnehmer laut Sperrliste und
 * vorhandenen Terminen können. Benötigte wiegen schwerer als optionale.
 * Reine Funktionen, damit Probenplanung (Server) und Gewerk-Portal (Client) dasselbe rechnen.
 */

export type FinderParticipant = { userId: string; level: ParticipationLevel };

export type FinderDay = {
  /** yyyy-MM-dd (Europe/Berlin). */
  dateKey: string;
  blocks: DayAvailability;
  /** Wer im gewünschten Zeitfenster schon einen anderen Termin hat (Person → Titel). */
  busy: Partial<Record<string, string>>;
};

export type FinderCounts = { free: number; limited: number; blocked: number; busy: number };

export type FinderRating = "good" | "ok" | "bad";

export type RankedDay = {
  dateKey: string;
  score: number;
  rating: FinderRating;
  required: FinderCounts;
  optional: FinderCounts;
  /** Benötigte, die nicht können (gesperrt oder anderer Termin). */
  missingRequired: string[];
  /** Benötigte mit Einschränkung. */
  limitedRequired: string[];
};

const WEIGHTS = {
  REQUIRED: { blocked: 10, busy: 6, limited: 3 },
  OPTIONAL: { blocked: 2, busy: 1, limited: 1 },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Wochentag eines Datums-Schlüssels (0 = Sonntag). */
export function weekdayOf(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

/** Alle Tage von `from` bis `to` (einschließlich) an den gewählten Wochentagen, höchstens `limit`. */
export function candidateDays({
  from,
  to,
  weekdays,
  limit = 120,
}: {
  from: string;
  to: string;
  weekdays: readonly number[];
  limit?: number;
}) {
  const allowed = new Set(weekdays);
  const days: string[] = [];
  const end = new Date(`${to}T12:00:00Z`).getTime();
  for (let time = new Date(`${from}T12:00:00Z`).getTime(); time <= end; time += DAY_MS) {
    const key = new Date(time).toISOString().slice(0, 10);
    if (allowed.size && !allowed.has(weekdayOf(key))) continue;
    days.push(key);
    if (days.length >= limit) break;
  }
  return days;
}

function statusOf(day: FinderDay, userId: string) {
  const block = day.blocks[userId];
  if (block === "blocked") return "blocked" as const;
  if (day.busy[userId]) return "busy" as const;
  if (block === "limited") return "limited" as const;
  return "free" as const;
}

/** Bewertet einen Tag für die Teilnehmer. */
export function rateDay(participants: readonly FinderParticipant[], day: FinderDay): RankedDay {
  const required: FinderCounts = { free: 0, limited: 0, blocked: 0, busy: 0 };
  const optional: FinderCounts = { free: 0, limited: 0, blocked: 0, busy: 0 };
  const missingRequired: string[] = [];
  const limitedRequired: string[] = [];
  let penalty = 0;

  for (const participant of participants) {
    const status = statusOf(day, participant.userId);
    const counts = participant.level === "REQUIRED" ? required : optional;
    counts[status] += 1;
    if (status !== "free") penalty += WEIGHTS[participant.level][status];
    if (participant.level !== "REQUIRED") continue;
    if (status === "blocked" || status === "busy") missingRequired.push(participant.userId);
    else if (status === "limited") limitedRequired.push(participant.userId);
  }

  const rating: FinderRating = missingRequired.length
    ? "bad"
    : limitedRequired.length
      ? "ok"
      : "good";
  return {
    dateKey: day.dateKey,
    score: penalty ? -penalty : 0,
    rating,
    required,
    optional,
    missingRequired,
    limitedRequired,
  };
}

/** Tage nach Eignung sortiert (beste zuerst, bei Gleichstand früher zuerst). */
export function rankDays(participants: readonly FinderParticipant[], days: readonly FinderDay[]) {
  return days
    .map((day) => rateDay(participants, day))
    .sort((a, b) => b.score - a.score || a.dateKey.localeCompare(b.dateKey));
}
