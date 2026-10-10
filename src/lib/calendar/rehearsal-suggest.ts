import type { SceneReadinessStatus } from "@/lib/calendar/scene-readiness";

/**
 * „Probe vorschlagen“: welche Szenen in einen Zeitrahmen passen und in welcher Reihenfolge
 * möglichst wenig gewartet wird. Nur ein Vorschlag – die Planung hakt ab und übernimmt.
 */

export type SceneCandidate = {
  sceneId: string;
  label: string;
  durationMinutes: number;
  readiness: SceneReadinessStatus;
  /** Besetzung (wer zur Szene kommen muss). */
  people: readonly string[];
  /** Bisher geprobt / noch angesetzt. */
  done: number;
  planned: number;
  /** Probenwochen seit dem letzten Mal. */
  blocksSince: number;
  behind: readonly ("long" | "rare")[];
  /** Wie viele aus der Besetzung diese Woche schon viel da sind. */
  heavyPeople?: number;
};

export type ScoredScene = SceneCandidate & { urgency: number; reasons: string[] };

const READINESS_FACTOR: Record<SceneReadinessStatus, number> = {
  ready: 1,
  alternate: 0.8,
  limited: 0.5,
  missing: 0,
};

/** Dringlichkeit: Rückstand in Probenwochen, wenig geprobt, heute gut besetzt. */
export function scoreScene(candidate: SceneCandidate): ScoredScene {
  const reasons: string[] = [];
  let value = 1;
  if (candidate.done === 0) {
    value += 4;
    reasons.push("noch nie geprobt");
  } else {
    value += 3 / (1 + candidate.done);
  }
  if (candidate.blocksSince > 0) {
    value += Math.min(candidate.blocksSince, 6);
    if (candidate.done > 0 && candidate.blocksSince >= 2)
      reasons.push(`seit ${candidate.blocksSince} Probenwochen nicht`);
  }
  if (candidate.behind.includes("rare")) {
    value += 2;
    reasons.push("seltener als die anderen");
  }
  if (candidate.planned > 0) {
    value *= 0.6;
    reasons.push(`schon ${candidate.planned}× angesetzt`);
  }
  if (candidate.heavyPeople) {
    value /= 1 + 0.15 * candidate.heavyPeople;
    reasons.push(
      candidate.heavyPeople === 1
        ? "1 Person diese Woche schon oft da"
        : `${candidate.heavyPeople} Leute diese Woche schon oft da`,
    );
  }
  if (candidate.readiness === "alternate") reasons.push("mit Zweitbesetzung");
  if (candidate.readiness === "limited") reasons.push("jemand eingeschränkt");
  return { ...candidate, urgency: value * READINESS_FACTOR[candidate.readiness], reasons };
}

export function rankScenes(candidates: readonly SceneCandidate[]) {
  return candidates
    .map(scoreScene)
    .filter((entry) => entry.urgency > 0)
    .sort((a, b) => b.urgency - a.urgency || a.label.localeCompare(b.label, "de"));
}

/**
 * Gierige Auswahl bis der Rahmen voll ist: beste Dringlichkeit pro Minute, mit Bonus für
 * Szenen, deren Besetzung schon da ist (→ wenige verschiedene Leute).
 */
export function pickScenes(
  ranked: readonly ScoredScene[],
  budgetMinutes: number,
  alreadyPeople: Iterable<string> = [],
) {
  const people = new Set(alreadyPeople);
  const picked: ScoredScene[] = [];
  let used = 0;
  const rest = [...ranked];
  while (rest.length) {
    let best = -1;
    let bestScore = 0;
    rest.forEach((entry, index) => {
      if (used + entry.durationMinutes > budgetMinutes) return;
      const known = entry.people.filter((id) => people.has(id)).length;
      const overlap = entry.people.length ? known / entry.people.length : 1;
      const score = (entry.urgency * (1 + overlap)) / Math.max(entry.durationMinutes, 5);
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    if (best < 0) break;
    const [entry] = rest.splice(best, 1);
    if (!entry) break;
    picked.push(entry);
    used += entry.durationMinutes;
    for (const id of entry.people) people.add(id);
  }
  return { picked, used, people: people.size };
}

type Orderable = { id: string; durationMinutes: number; people: readonly string[] };

/** Wartezeit pro Person (Fenster minus eigene Zeit), wenn alle nacheinander laufen. */
export function waitByPerson(order: readonly Orderable[]) {
  const spans = new Map<string, { first: number; last: number; busy: number }>();
  let cursor = 0;
  for (const item of order) {
    const end = cursor + item.durationMinutes;
    for (const id of item.people) {
      const span = spans.get(id);
      if (span) {
        span.last = end;
        span.busy += item.durationMinutes;
      } else {
        spans.set(id, { first: cursor, last: end, busy: item.durationMinutes });
      }
    }
    cursor = end;
  }
  return new Map(Array.from(spans, ([id, span]) => [id, span.last - span.first - span.busy]));
}

export function totalWait(order: readonly Orderable[]) {
  let total = 0;
  for (const wait of waitByPerson(order).values()) total += wait;
  return total;
}

/**
 * Reihenfolge mit möglichst wenig Wartezeit. Bis 7 Punkte exakt, darüber Tauschen benachbarter
 * und beliebiger Paare, bis sich nichts mehr verbessert.
 */
export function optimizeOrder<T extends Orderable>(items: readonly T[]): T[] {
  if (items.length < 3) return [...items];
  if (items.length <= 7) {
    let best = [...items];
    let bestWait = totalWait(best);
    const permute = (prefix: T[], rest: T[]) => {
      if (!rest.length) {
        const wait = totalWait(prefix);
        if (wait < bestWait) {
          bestWait = wait;
          best = prefix;
        }
        return;
      }
      rest.forEach((entry, index) => {
        permute([...prefix, entry], [...rest.slice(0, index), ...rest.slice(index + 1)]);
      });
    };
    permute([], [...items]);
    return best;
  }
  const order = [...items];
  let wait = totalWait(order);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        const next = [...order];
        const a = next[i];
        const b = next[j];
        if (!a || !b) continue;
        next[i] = b;
        next[j] = a;
        const nextWait = totalWait(next);
        if (nextWait < wait) {
          wait = nextWait;
          order.splice(0, order.length, ...next);
          improved = true;
        }
      }
    }
  }
  return order;
}
