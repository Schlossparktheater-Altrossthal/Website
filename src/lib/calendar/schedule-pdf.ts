import { DEFAULT_TIME_ZONE } from "@/lib/format/date";
import type { HolidayRange } from "@/types/holidays";

/**
 * Baut die Monate/Wochen der PDF-Vorlage „terminliste“: Termine nach Datum, dazwischen
 * Ferien und Feiertage als Hinweiszeilen, jede Woche mit Kalenderwoche.
 */

type Notice = { type: "notice"; kind: HolidayRange["category"]; text: string };
type Week<E> = { label: string | null; items: (E | Notice)[] };

const MONTH = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});
const SHORT = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});
const WEEKDAY = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: DEFAULT_TIME_ZONE });

const noon = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`);

/** Montag der Woche (yyyy-MM-dd). */
function weekStart(dayKey: string) {
  const date = noon(dayKey);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** ISO-Kalenderwoche. */
export function isoWeek(dayKey: string) {
  const date = noon(dayKey);
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

function noticeText(holiday: HolidayRange) {
  const start = noon(holiday.startDate);
  if (holiday.category === "publicHoliday" || holiday.startDate === holiday.endDate) {
    return `${holiday.title} · ${WEEKDAY.format(start).replace(/\.$/, "")} ${SHORT.format(start)}`;
  }
  return `${holiday.title} ${SHORT.format(start)}–${SHORT.format(noon(holiday.endDate))}`;
}

export function buildScheduleMonths<E>(
  entries: { dayKey: string; lastDayKey: string; event: E }[],
  holidays: HolidayRange[],
) {
  if (!entries.length) return [];
  const from = entries.reduce(
    (min, entry) => (entry.dayKey < min ? entry.dayKey : min),
    entries[0].dayKey,
  );
  const to = entries.reduce(
    (max, entry) => (entry.lastDayKey > max ? entry.lastDayKey : max),
    entries[0].lastDayKey,
  );

  // Hinweise vor den Terminen desselben Tages; laufende Ferien erscheinen am Anfang.
  const items: { key: string; order: number; item: E | Notice }[] = [
    ...holidays
      .filter((holiday) => holiday.endDate >= from && holiday.startDate <= to)
      .map((holiday) => ({
        key: holiday.startDate < from ? from : holiday.startDate,
        order: 0,
        item: { type: "notice" as const, kind: holiday.category, text: noticeText(holiday) },
      })),
    ...entries.map((entry) => ({ key: entry.dayKey, order: 1, item: entry.event })),
  ].sort((a, b) => a.key.localeCompare(b.key) || a.order - b.order);

  const months: { label: string; weeks: Week<E>[] }[] = [];
  let lastWeek = "";
  for (const { key, item } of items) {
    const label = MONTH.format(noon(key));
    let month = months.at(-1);
    if (!month || month.label !== label) {
      month = { label, weeks: [] };
      months.push(month);
      lastWeek = "";
    }
    const week = weekStart(key);
    if (week !== lastWeek) {
      month.weeks.push({ label: `KW ${isoWeek(key)}`, items: [] });
      lastWeek = week;
    }
    month.weeks.at(-1)!.items.push(item);
  }
  return months;
}
