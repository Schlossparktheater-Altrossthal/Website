import {
  confidence,
  dayKey,
  sceneProgress,
  weekStart,
  type LearnItem,
  type QueueInput,
} from "./plan";
import { applyRating, retrievability, type CardState, type LearnRating } from "./schedule";

/** Auswertungen für die Lern-Statistik (docs/Plan/lernmodus-plan.md, Runde 2); reine Logik. */

/** Eine Abfrage, schon auf den Schlüssel der Karte (Rolle|Replik|Abschnitt) abgebildet. */
export type HistoryEntry = { key: string; at: string; rating: number; mode: string };

export type DayCount = { day: string; count: number };

/**
 * Abfragen je Tag der letzten `weeks` Wochen, Montag bis Sonntag, endet mit der laufenden Woche
 * (für die Lerntage-Kacheln).
 */
export function dailyCounts(history: readonly HistoryEntry[], now: Date, weeks = 12) {
  const counts = new Map<string, number>();
  for (const entry of history) {
    const key = dayKey(new Date(entry.at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  const days: DayCount[] = [];
  for (let offset = 0; offset < weeks * 7; offset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    const key = dayKey(day);
    days.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return days;
}

/** Textsicherheit heute und nach so vielen Tagen ohne Lernen (Vergessens-Prognose). */
export function forecast(input: QueueInput, days: readonly number[] = [0, 3, 7, 14]) {
  return days.map((offset) => ({
    days: offset,
    value: confidence(input, new Date(input.now.getTime() + offset * 86_400_000)),
  }));
}

function unitOf(item: Pick<LearnItem, "lineageId" | "chunk">) {
  return `${item.lineageId}|${item.chunk}`;
}

export type ProblemUnit = { unitId: string; sceneId: string; lapses: number; difficulty: number };

/**
 * Problemstellen: oft vergessen („Nochmal“ nach dem Lernen) oder schwer. Je Stelle die
 * schwächste Rollen-Karte; neue Stellen zählen nicht.
 */
export function problemUnits(input: QueueInput, limit = 5) {
  const result = new Map<string, ProblemUnit>();
  for (const item of input.items) {
    const card = input.cards.get(item.key);
    if (!card) continue;
    const id = unitOf(item);
    const known = result.get(id);
    if (known && known.lapses >= card.lapses && known.difficulty >= card.difficulty) continue;
    result.set(id, {
      unitId: id,
      sceneId: item.sceneId,
      lapses: Math.max(card.lapses, known?.lapses ?? 0),
      difficulty: Math.max(card.difficulty, known?.difficulty ?? 0),
    });
  }
  return [...result.values()]
    .filter((entry) => entry.lapses > 0 || entry.difficulty >= 7)
    .sort((a, b) => b.lapses - a.lapses || b.difficulty - a.difficulty)
    .slice(0, limit);
}

export type CueWeakness = { unitId: string; sceneId: string; flow: number; drill: number };

/**
 * Stichwort-Schwächen: Stellen, die im Szenenfluss deutlich schlechter laufen als in der
 * Einzelabfrage – der Text sitzt, aber der Einsatz aus der Szene heraus noch nicht.
 */
export function cueWeaknesses(
  history: readonly HistoryEntry[],
  items: readonly LearnItem[],
  limit = 5,
) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const stats = new Map<string, { sceneId: string; flow: number[]; drill: number[] }>();
  for (const entry of history) {
    const item = byKey.get(entry.key);
    if (!item || (entry.mode !== "flow" && entry.mode !== "drill")) continue;
    const id = unitOf(item);
    const stat = stats.get(id) ?? { sceneId: item.sceneId, flow: [], drill: [] };
    stat[entry.mode].push(entry.rating);
    stats.set(id, stat);
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const result: CueWeakness[] = [];
  for (const [unitId, stat] of stats) {
    if (!stat.flow.length || !stat.drill.length) continue;
    const flow = mean(stat.flow);
    const drill = mean(stat.drill);
    if (drill - flow >= 0.75) result.push({ unitId, sceneId: stat.sceneId, flow, drill });
  }
  return result.sort((a, b) => b.drill - b.flow - (a.drill - a.flow)).slice(0, limit);
}

export type ConfidencePoint = { day: string; value: number };

/**
 * Verlauf der Textsicherheit: Abfragen je Karte nachspielen und am Ende jedes Tages die mittlere
 * Abrufwahrscheinlichkeit messen (wie `confidence`, ohne Sonderregeln für geänderten Text).
 * Beginnt am ersten Lerntag innerhalb von `days` Tagen.
 */
export function confidenceHistory(
  input: QueueInput,
  history: readonly HistoryEntry[],
  days = 56,
): ConfidencePoint[] {
  const units = new Map<string, string[]>();
  for (const item of input.items) {
    const id = unitOf(item);
    units.set(id, [...(units.get(id) ?? []), item.key]);
  }
  if (!units.size) return [];
  const byKey = new Map<string, HistoryEntry[]>();
  for (const entry of [...history].sort((a, b) => a.at.localeCompare(b.at))) {
    byKey.set(entry.key, [...(byKey.get(entry.key) ?? []), entry]);
  }
  const first = history.reduce<string | null>(
    (min, entry) => (min === null || entry.at < min ? entry.at : min),
    null,
  );
  if (!first) return [];
  const start = new Date(
    Math.max(Date.parse(first), input.now.getTime() - (days - 1) * 86_400_000),
  );
  start.setHours(0, 0, 0, 0);

  const states = new Map<string, CardState | null>();
  const cursor = new Map<string, number>();
  const points: ConfidencePoint[] = [];
  for (let day = new Date(start); day <= input.now; day.setDate(day.getDate() + 1)) {
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    const at = end > input.now ? input.now : end;
    let sum = 0;
    for (const keys of units.values()) {
      let weakest = 1;
      for (const key of keys) {
        const entries = byKey.get(key) ?? [];
        let index = cursor.get(key) ?? 0;
        let state = states.get(key) ?? null;
        while (index < entries.length && Date.parse(entries[index].at) <= at.getTime()) {
          state = applyRating(
            state,
            entries[index].rating as LearnRating,
            new Date(entries[index].at),
          );
          index++;
        }
        cursor.set(key, index);
        states.set(key, state);
        weakest = Math.min(weakest, retrievability(state, at));
      }
      sum += weakest;
    }
    points.push({ day: dayKey(day), value: sum / units.size });
  }
  return points;
}

export type Milestone = {
  id: string;
  label: string;
  detail: string;
  current: number;
  target: number;
  achieved: boolean;
};

/** Wochen (Mo–So) im Verlauf, in denen das Wochenziel (Lerntage) erreicht wurde. */
export function goalWeeks(history: readonly HistoryEntry[], weeklyDays: number) {
  const weeks = new Map<string, Set<string>>();
  for (const entry of history) {
    const date = new Date(entry.at);
    const week = dayKey(weekStart(date));
    weeks.set(week, (weeks.get(week) ?? new Set()).add(dayKey(date)));
  }
  return [...weeks.values()].filter((daysOfWeek) => daysOfWeek.size >= weeklyDays).length;
}

/** Meilensteine für Statistik und Feier; alle aus vorhandenen Daten berechnet. */
export function milestones(
  input: QueueInput,
  history: readonly HistoryEntry[],
  weeklyDays: number,
): Milestone[] {
  const progress = sceneProgress(input);
  const units = progress.reduce((sum, entry) => sum + entry.total, 0);
  const solid = progress.reduce((sum, entry) => sum + entry.solid, 0);
  const started = progress.reduce((sum, entry) => sum + entry.total - entry.new, 0);
  const scenes = progress.length;
  const solidScenes = progress.filter((entry) => entry.total && entry.solid === entry.total).length;
  const reviews = input.items.reduce(
    (sum, item) => sum + (input.cards.get(item.key)?.reps ?? 0),
    0,
  );
  const weeks = goalWeeks(history, weeklyDays);
  const half = Math.max(1, Math.ceil(scenes / 2));
  const list: Omit<Milestone, "achieved">[] = [
    {
      id: "erste-stelle",
      label: "Erste Stelle sitzt",
      detail: "Eine Stelle fest im Kopf",
      current: Math.min(solid, 1),
      target: 1,
    },
    {
      id: "alles-angefangen",
      label: "Alles angefangen",
      detail: "Jede Stelle einmal gelernt",
      current: started,
      target: units,
    },
    {
      id: "erste-szene",
      label: "Erste Szene sitzt",
      detail: "Alle Stellen einer Szene",
      current: Math.min(solidScenes, 1),
      target: 1,
    },
    {
      id: "halbzeit",
      label: "Halbzeit",
      detail: `${half} von ${scenes} Szenen sitzen`,
      current: Math.min(solidScenes, half),
      target: half,
    },
    {
      id: "ganze-rolle",
      label: "Ganze Rolle sitzt",
      detail: "Alle Szenen sitzen",
      current: solidScenes,
      target: scenes,
    },
    {
      id: "abfragen-100",
      label: "100 Abfragen",
      detail: "Fleißig geübt",
      current: Math.min(reviews, 100),
      target: 100,
    },
    {
      id: "abfragen-500",
      label: "500 Abfragen",
      detail: "Textprofi",
      current: Math.min(reviews, 500),
      target: 500,
    },
    {
      id: "wochenziel",
      label: "Wochenziel geschafft",
      detail: `${weeklyDays} Lerntage in einer Woche`,
      current: Math.min(weeks, 1),
      target: 1,
    },
    {
      id: "wochenziel-3",
      label: "Dreimal Wochenziel",
      detail: "In drei Wochen geschafft",
      current: Math.min(weeks, 3),
      target: 3,
    },
  ];
  return list
    .filter((entry) => entry.target > 0)
    .map((entry) => ({ ...entry, achieved: entry.current >= entry.target }));
}
