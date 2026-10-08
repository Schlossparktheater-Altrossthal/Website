/** Termin, so wie ihn die Belastungsrechnung braucht. */
export type LoadEvent = {
  id: string;
  /** Kalendertag (yyyy-MM-dd, Europe/Berlin). */
  dayKey: string;
  start: string;
  end: string | null;
  /** Eingeladene ohne Absage. */
  userIds: readonly string[];
};

export type PersonLoad = {
  count: number;
  minutes: number;
  /** Tage (yyyy-MM-dd) der Termine in der Woche. */
  dayKeys: string[];
};

/** Ab drei Terminen in einer Woche wird die Belastung hervorgehoben. */
export const HEAVY_WEEK_COUNT = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" });

function keyToDate(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

function dateToKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function shiftDayKey(key: string, days: number) {
  return dateToKey(new Date(keyToDate(key).getTime() + days * DAY_MS));
}

/** Montag und Sonntag der Kalenderwoche eines Tages. */
export function weekBounds(dayKey: string) {
  const weekday = (keyToDate(dayKey).getUTCDay() + 6) % 7;
  const from = shiftDayKey(dayKey, -weekday);
  return { from, to: shiftDayKey(from, 6) };
}

export function weekdayShort(dayKey: string) {
  return WEEKDAY.format(keyToDate(dayKey)).replace(".", "");
}

/** Termine und Stunden pro Person in der Kalenderwoche von `dayKey`, ohne `excludeEventId`. */
export function computeWeekLoad(
  events: readonly LoadEvent[],
  dayKey: string,
  excludeEventId?: string,
): Record<string, PersonLoad> {
  const { from, to } = weekBounds(dayKey);
  const load: Record<string, PersonLoad> = {};
  for (const event of events) {
    if (event.id === excludeEventId || event.dayKey < from || event.dayKey > to) continue;
    const minutes = event.end
      ? Math.max(0, Math.round((Date.parse(event.end) - Date.parse(event.start)) / 60000))
      : 0;
    for (const userId of event.userIds) {
      const entry = (load[userId] ??= { count: 0, minutes: 0, dayKeys: [] });
      entry.count += 1;
      entry.minutes += minutes;
      if (!entry.dayKeys.includes(event.dayKey)) entry.dayKeys.push(event.dayKey);
    }
  }
  for (const entry of Object.values(load)) entry.dayKeys.sort();
  return load;
}

function formatHours(minutes: number) {
  const hours = Math.round(minutes / 30) / 2;
  return `${hours.toLocaleString("de-DE")} h`;
}

/**
 * Kurztext für eine Person am Termintag: „diese Woche schon 2× · 5 h · auch Sa“.
 * `heavy`: mit diesem Termin mindestens {@link HEAVY_WEEK_COUNT} Termine;
 * `neighbors`: Vortag/Folgetag, an denen die Person auch eingeladen ist.
 */
export function describeLoad(load: PersonLoad | undefined, dayKey: string) {
  if (!load?.count) return null;
  const neighbors = [shiftDayKey(dayKey, -1), shiftDayKey(dayKey, 1)].filter((key) =>
    load.dayKeys.includes(key),
  );
  const parts = [`diese Woche schon ${load.count}×`];
  if (load.minutes) parts.push(formatHours(load.minutes));
  if (neighbors.length) parts.push(`auch ${neighbors.map(weekdayShort).join(" + ")}`);
  return {
    text: parts.join(" · "),
    heavy: load.count + 1 >= HEAVY_WEEK_COUNT,
    neighbors,
  };
}
