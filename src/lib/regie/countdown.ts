import type { StatTileTone } from "@/components/ui/stat-tile";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

/**
 * Kennzahlen oben im Regie-Dashboard: Tage bis Endprobenwoche und Premiere, Proben bis zur
 * Premiere, ungeprobte Szenen. Rechnet in Kalendertagen (Europe/Berlin), nicht in 24-h-Schritten.
 */

export type DirectionCountdownInput = {
  now: Date;
  finalRehearsalWeekStart: Date | null;
  finalRehearsalWeekEnd: Date | null;
  premiereAt: Date | null;
  /** Nicht abgesagte Vorstellungen, aufsteigend. */
  performances: Date[];
  /** Kommende, nicht abgesagte Proben (Start). */
  upcomingRehearsals: Date[];
  sceneCount: number;
  rehearsedSceneCount: number;
};

export type DirectionStat = {
  key: "endproben" | "premiere" | "proben" | "szenen";
  label: string;
  value: string;
  hint?: string;
  tone: StatTileTone;
};

const DAY_MS = 86_400_000;
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE });
const dayKeyOf = (date: Date) => DAY_KEY.format(date);
const dayNumber = (date: Date) => Date.parse(`${dayKeyOf(date)}T00:00:00Z`) / DAY_MS;
const daysBetween = (from: Date, to: Date) => dayNumber(to) - dayNumber(from);
const SHORT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});
const short = (date: Date) => SHORT.format(date).replace(/\.,/, ",");

function countdownTone(days: number, warnAt: number, alarmAt: number): StatTileTone {
  return days <= alarmAt ? "destructive" : days <= warnAt ? "warning" : "primary";
}

export function buildDirectionCountdown(input: DirectionCountdownInput): DirectionStat[] {
  const { now } = input;
  const stats: DirectionStat[] = [];

  const premiere = input.performances[0] ?? input.premiereAt;
  const lastPerformance = input.performances.at(-1) ?? premiere;

  // Endprobenwoche: vorher Countdown, währenddessen „Tag x von y“, danach ausgeblendet.
  const frwStart = input.finalRehearsalWeekStart;
  if (frwStart) {
    const frwEnd = input.finalRehearsalWeekEnd ?? new Date(frwStart.getTime() + 6 * DAY_MS);
    const until = daysBetween(now, frwStart);
    if (until > 0) {
      stats.push({
        key: "endproben",
        label: "Tage bis Endproben",
        value: String(until),
        hint: `ab ${short(frwStart)}`,
        tone: countdownTone(until, 14, 3),
      });
    } else if (daysBetween(now, frwEnd) >= 0) {
      stats.push({
        key: "endproben",
        label: "Endprobenwoche",
        value: until === 0 ? "Heute" : "Läuft",
        hint: `Tag ${1 - until} von ${daysBetween(frwStart, frwEnd) + 1}`,
        tone: "warning",
      });
    }
  } else {
    stats.push({
      key: "endproben",
      label: "Tage bis Endproben",
      value: "–",
      hint: "Noch kein Termin",
      tone: "neutral",
    });
  }

  // Premiere: Countdown, danach verbleibende Vorstellungen bis zur Dernière.
  if (premiere) {
    const until = daysBetween(now, premiere);
    if (until > 0) {
      stats.push({
        key: "premiere",
        label: "Tage bis Premiere",
        value: String(until),
        hint: short(premiere),
        tone: countdownTone(until, 21, 7),
      });
    } else if (until === 0) {
      stats.push({ key: "premiere", label: "Premiere", value: "Heute", tone: "success" });
    } else if (lastPerformance && daysBetween(now, lastPerformance) >= 0) {
      const left = input.performances.filter((date) => daysBetween(now, date) >= 0).length;
      stats.push({
        key: "premiere",
        label: "Vorstellungen",
        value: `${left} übrig`,
        hint: `von ${input.performances.length}`,
        tone: "success",
      });
    }
  } else {
    stats.push({
      key: "premiere",
      label: "Tage bis Premiere",
      value: "–",
      hint: "Noch kein Termin",
      tone: "neutral",
    });
  }

  // Proben bis zur Premiere (nur solange sie bevorsteht).
  if (!premiere || daysBetween(now, premiere) > 0) {
    const rehearsals = premiere
      ? input.upcomingRehearsals.filter((start) => start < premiere)
      : input.upcomingRehearsals;
    const beforeFrw = frwStart
      ? rehearsals.filter((start) => daysBetween(start, frwStart) > 0).length
      : null;
    stats.push({
      key: "proben",
      label: premiere ? "Proben bis Premiere" : "Kommende Proben",
      value: String(rehearsals.length),
      hint:
        beforeFrw !== null && daysBetween(now, frwStart!) > 0
          ? `${beforeFrw} vor der Endprobenwoche`
          : undefined,
      tone: rehearsals.length ? "primary" : "neutral",
    });
  }

  // Szenen, die noch in keiner Probe stehen (vergangen oder geplant).
  if (input.sceneCount) {
    const open = Math.max(0, input.sceneCount - input.rehearsedSceneCount);
    const soon = premiere ? daysBetween(now, premiere) <= 28 : false;
    stats.push({
      key: "szenen",
      label: "Szenen ohne Probe",
      value: String(open),
      hint: `${input.rehearsedSceneCount} von ${input.sceneCount} eingeplant`,
      tone: open === 0 ? "success" : soon ? "warning" : "neutral",
    });
  }

  return stats;
}
