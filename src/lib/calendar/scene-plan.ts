import { shiftDayKey, weekBounds } from "@/lib/calendar/week-load";

/** Eine Szene in einer Probe. */
export type ScenePlanEntry = {
  sceneId: string;
  eventId: string;
  dayKey: string;
  /** Probe liegt in der Vergangenheit (gilt als geprobt). */
  done: boolean;
};

export type ScenePlanWeek = {
  /** Montag (yyyy-MM-dd). */
  from: string;
  label: string;
  current: boolean;
  premiere: boolean;
};

export type ScenePlanCell = { done: number; planned: number; dayKeys: string[] };

export type ScenePlanRow = {
  sceneId: string;
  label: string;
  cells: ScenePlanCell[];
  done: number;
  planned: number;
  lastDone: string | null;
  nextPlanned: string | null;
  /**
   * Probenwochen der Produktion seit dem letzten Mal (nie geprobt: alle bisherigen). Eine Woche
   * mit Proben ist ein Probenblock – bei Kerntagen Fr–So zählt ein Wochenende einmal, nicht
   * dreimal.
   */
  blocksSince: number;
  /** Tage seit dem letzten Mal, null wenn nie geprobt. */
  daysSince: number | null;
  /**
   * Hinkt hinterher – gemessen am Probenrhythmus der Produktion, nicht an festen Tagen:
   * `long` = seit {@link LONG_AGO_BLOCKS} Probenwochen nicht dran und nichts angesetzt,
   * `rare` = weniger als halb so oft geprobt wie der Schnitt.
   */
  behind: ("long" | "rare")[];
};

export const LONG_AGO_BLOCKS = 2;
const WEEKS_BEFORE = 4;
const DEFAULT_WEEKS_AFTER = 8;
const MAX_WEEKS = 20;

function isoWeek(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % 7)) * 86400000);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((thursday.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

/**
 * Szene × Woche: von vier Wochen zurück bis zur Premiere (sonst acht Wochen voraus),
 * höchstens {@link MAX_WEEKS} Spalten.
 */
export function buildScenePlan({
  scenes,
  entries,
  todayKey,
  premiereKey,
}: {
  scenes: readonly { id: string; label: string }[];
  entries: readonly ScenePlanEntry[];
  todayKey: string;
  premiereKey: string | null;
}) {
  const currentWeek = weekBounds(todayKey).from;
  const first = shiftDayKey(currentWeek, -7 * WEEKS_BEFORE);
  const premiereWeek = premiereKey ? weekBounds(premiereKey).from : null;
  const last =
    premiereWeek && premiereWeek > currentWeek
      ? premiereWeek
      : shiftDayKey(currentWeek, 7 * DEFAULT_WEEKS_AFTER);
  const count = Math.min(MAX_WEEKS, daysBetween(first, last) / 7 + 1);
  const weeks: ScenePlanWeek[] = Array.from({ length: count }, (_, index) => {
    const from = shiftDayKey(first, index * 7);
    return {
      from,
      label: `KW ${isoWeek(from)}`,
      current: from === currentWeek,
      premiere: from === premiereWeek,
    };
  });
  const weekIndex = new Map(weeks.map((week, index) => [week.from, index]));

  // Bisherige Szenenproben und Probenwochen der Produktion – Maßstab für „lange her“.
  const past = entries.filter((entry) => entry.done);
  const pastRehearsals = new Set(past.map((entry) => entry.eventId)).size;
  const pastWeeks = [...new Set(past.map((entry) => weekBounds(entry.dayKey).from))];
  const rows: ScenePlanRow[] = scenes.map((scene) => {
    const own = entries.filter((entry) => entry.sceneId === scene.id);
    const cells: ScenePlanCell[] = weeks.map(() => ({ done: 0, planned: 0, dayKeys: [] }));
    for (const entry of own) {
      const cell = cells[weekIndex.get(weekBounds(entry.dayKey).from) ?? -1];
      if (!cell) continue;
      if (entry.done) cell.done += 1;
      else cell.planned += 1;
      if (!cell.dayKeys.includes(entry.dayKey)) cell.dayKeys.push(entry.dayKey);
    }
    const doneKeys = own.filter((entry) => entry.done).map((entry) => entry.dayKey);
    const plannedKeys = own.filter((entry) => !entry.done).map((entry) => entry.dayKey);
    const lastDone = doneKeys.sort().at(-1) ?? null;
    const nextPlanned = plannedKeys.sort()[0] ?? null;
    return {
      sceneId: scene.id,
      label: scene.label,
      cells,
      done: doneKeys.length,
      planned: plannedKeys.length,
      lastDone,
      nextPlanned,
      blocksSince: pastWeeks.filter((week) => !lastDone || week > weekBounds(lastDone).from).length,
      daysSince: lastDone ? daysBetween(lastDone, todayKey) : null,
      behind: [],
    };
  });

  const averageDone = rows.length ? rows.reduce((sum, row) => sum + row.done, 0) / rows.length : 0;
  for (const row of rows) {
    if (!row.nextPlanned && row.blocksSince >= LONG_AGO_BLOCKS) row.behind.push("long");
    if (averageDone >= 2 && row.done < averageDone / 2) row.behind.push("rare");
  }
  return {
    weeks,
    rows,
    summary: { rehearsals: pastRehearsals, weeks: pastWeeks.length, averageDone },
  };
}
