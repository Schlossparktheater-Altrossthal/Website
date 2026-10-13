import { confidence, dayKey, type LearnItem, type QueueInput } from "./plan";

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
