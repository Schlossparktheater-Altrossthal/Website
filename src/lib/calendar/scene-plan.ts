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
  /** Länger als {@link STALE_DAYS} Tage nicht geprobt und nichts angesetzt. */
  stale: boolean;
};

export const STALE_DAYS = 14;
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
      stale: !nextPlanned && (!lastDone || daysBetween(lastDone, todayKey) > STALE_DAYS),
    };
  });
  return { weeks, rows };
}
