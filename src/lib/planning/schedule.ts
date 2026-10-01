import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

/**
 * Rechenkern der Produktionsplanung (docs/Plan/projektplanung-plan.md).
 *
 * Alle Daten sind Kalendertage, gespeichert als UTC-Mitternacht. Gerechnet wird in ganzen
 * Tagen; „heute“ ist der Kalendertag in `Europe/Berlin`. Bewusst keine volle CPM-Rechnung:
 * nur Fristen, Puffer rückwärts über Abhängigkeiten und Verzug vorwärts ab heute.
 */

export type MilestoneAnchorType = "premiere" | "finalRehearsalStart" | "milestone" | "fixed";

export type PlanAnchors = {
  premiereAt: Date | null;
  finalRehearsalStart: Date | null;
};

export type ScheduleMilestone = {
  id: string;
  anchorType: MilestoneAnchorType;
  anchorMilestoneId?: string | null;
  offsetDays: number;
  fixedDate?: Date | null;
  doneAt?: Date | null;
};

export type ScheduleDependency = {
  fromId: string;
  toId: string;
  lagDays: number;
};

/** Ampel: grün im Plan · gelb wenig Puffer · rot überfällig/kritisch · grau erledigt. */
export type MilestoneHealth = "done" | "overdue" | "critical" | "warning" | "ok" | "unscheduled";

export type MilestoneSchedule = {
  id: string;
  dueAt: Date | null;
  /** Spätestes Datum, ohne Nachfolger oder Premiere zu gefährden. `null` = ohne Grenze. */
  latestAt: Date | null;
  /** latestAt − dueAt in Tagen; ≤ 0 heißt kritisch. */
  slackDays: number | null;
  /** Voraussichtliches Datum, wenn überfällige Vorgänger erst ab heute fertig werden. */
  projectedAt: Date | null;
  /** Überfällige Meilensteine, die diesen nach hinten schieben. */
  endangeredBy: string[];
  health: MilestoneHealth;
};

export const WARNING_SLACK_DAYS = 7;

const DAY_MS = 86_400_000;

export function toDay(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

export function fromDay(day: number): Date {
  return new Date(day * DAY_MS);
}

/** Kalendertag von `now` in Berlin als UTC-Mitternacht. */
export function todayInTimeZone(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Tage von heute (Berlin) bis `target`; positiv = in der Zukunft, für „T−290“. */
export function daysUntil(target: Date | null, now: Date = new Date()): number | null {
  if (!target) return null;
  return toDay(target) - toDay(todayInTimeZone(now));
}

/** „T−290“ vor, „T+3“ nach dem Stichtag. */
export function formatCountdown(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "T−0";
  return days > 0 ? `T−${days}` : `T+${-days}`;
}

export class PlanCycleError extends Error {
  constructor(readonly cycle: string[]) {
    super(`Zyklus im Plan: ${cycle.join(" → ")}`);
    this.name = "PlanCycleError";
  }
}

/**
 * Sucht einen Zyklus über Abhängigkeiten und Anker-Bezüge („B relativ zu A“ zählt als A → B).
 * Gibt die Kette zurück (erster Knoten am Ende wiederholt) oder `null`.
 */
export function findCycle(
  milestones: ScheduleMilestone[],
  dependencies: ScheduleDependency[],
): string[] | null {
  const edges = buildEdges(milestones, dependencies);
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const next of edges.get(id) ?? []) {
      const seen = state.get(next);
      if (seen === 1) return [...stack.slice(stack.indexOf(next)), next];
      if (seen === undefined) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };

  for (const milestone of milestones) {
    if (!state.has(milestone.id)) {
      const found = visit(milestone.id);
      if (found) return found;
    }
  }
  return null;
}

/** Fälligkeit aus Anker + Offset. Fehlt ein Anker (z. B. keine Premiere), bleibt sie `null`. */
export function computeDueDates(
  milestones: ScheduleMilestone[],
  anchors: PlanAnchors,
): Map<string, Date | null> {
  const byId = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  const result = new Map<string, number | null>();
  const resolving = new Set<string>();

  const resolve = (milestone: ScheduleMilestone): number | null => {
    const cached = result.get(milestone.id);
    if (cached !== undefined) return cached;
    if (resolving.has(milestone.id)) {
      throw new PlanCycleError([...resolving, milestone.id]);
    }
    resolving.add(milestone.id);

    let base: number | null = null;
    switch (milestone.anchorType) {
      case "premiere":
        base = anchors.premiereAt ? toDay(anchors.premiereAt) : null;
        break;
      case "finalRehearsalStart":
        base = anchors.finalRehearsalStart ? toDay(anchors.finalRehearsalStart) : null;
        break;
      case "fixed":
        base = milestone.fixedDate ? toDay(milestone.fixedDate) : null;
        break;
      case "milestone": {
        const anchor = milestone.anchorMilestoneId
          ? byId.get(milestone.anchorMilestoneId)
          : undefined;
        base = anchor ? resolve(anchor) : null;
        break;
      }
    }

    resolving.delete(milestone.id);
    // Beim festen Datum ist das Offset bedeutungslos; sonst „n Tage davor/danach“.
    const due =
      base === null ? null : milestone.anchorType === "fixed" ? base : base + milestone.offsetDays;
    result.set(milestone.id, due);
    return due;
  };

  milestones.forEach(resolve);
  return new Map([...result].map(([id, day]) => [id, day === null ? null : fromDay(day)]));
}

/** Berechnet Fälligkeit, Puffer, Verzug und Ampel für alle Meilensteine eines Plans. */
export function computeSchedule(
  milestones: ScheduleMilestone[],
  dependencies: ScheduleDependency[],
  anchors: PlanAnchors,
  now: Date = new Date(),
): Map<string, MilestoneSchedule> {
  const cycle = findCycle(milestones, dependencies);
  if (cycle) throw new PlanCycleError(cycle);

  const ids = new Set(milestones.map((milestone) => milestone.id));
  const deps = dependencies.filter((dep) => ids.has(dep.fromId) && ids.has(dep.toId));
  const dueDates = computeDueDates(milestones, anchors);
  const due = new Map([...dueDates].map(([id, date]) => [id, date ? toDay(date) : null] as const));
  const open = new Map(milestones.map((milestone) => [milestone.id, !milestone.doneAt]));
  const today = toDay(todayInTimeZone(now));
  const premiere = anchors.premiereAt ? toDay(anchors.premiereAt) : null;
  const order = topologicalOrder(milestones, deps);

  const successors = groupBy(deps, (dep) => dep.fromId);
  const predecessors = groupBy(deps, (dep) => dep.toId);

  // Rückwärts: spätestes Datum. Endpunkte vor der Premiere sind durch die Premiere begrenzt.
  const latest = new Map<string, number | null>();
  for (const id of [...order].reverse()) {
    const own = due.get(id) ?? null;
    let bound: number | null =
      own !== null && premiere !== null && own <= premiere ? premiere : null;
    for (const dep of successors.get(id) ?? []) {
      if (!open.get(dep.toId)) continue;
      const next = latest.get(dep.toId) ?? due.get(dep.toId) ?? null;
      if (next === null) continue;
      const candidate = next - dep.lagDays;
      bound = bound === null ? candidate : Math.min(bound, candidate);
    }
    latest.set(id, bound);
  }

  // Vorwärts: voraussichtliches Datum, wenn Überfälliges frühestens heute fertig wird.
  const projected = new Map<string, number | null>();
  const causes = new Map<string, Set<string>>();
  for (const id of order) {
    const own = due.get(id) ?? null;
    const reasons = new Set<string>();
    if (!open.get(id)) {
      projected.set(id, own);
      causes.set(id, reasons);
      continue;
    }
    let value = own;
    if (own !== null && own < today) {
      value = today;
      reasons.add(id);
    }
    for (const dep of predecessors.get(id) ?? []) {
      if (!open.get(dep.fromId)) continue;
      const before = projected.get(dep.fromId) ?? null;
      if (before === null) continue;
      const candidate = before + dep.lagDays;
      if (own !== null && candidate > own) {
        for (const cause of causes.get(dep.fromId) ?? []) reasons.add(cause);
      }
      value = value === null ? candidate : Math.max(value, candidate);
    }
    projected.set(id, value);
    causes.set(id, reasons);
  }

  const result = new Map<string, MilestoneSchedule>();
  for (const milestone of milestones) {
    const id = milestone.id;
    const own = due.get(id) ?? null;
    const bound = latest.get(id) ?? null;
    const slack = own !== null && bound !== null ? bound - own : null;
    const proj = projected.get(id) ?? null;
    const endangeredBy = [...(causes.get(id) ?? [])].filter((cause) => cause !== id);

    let health: MilestoneHealth;
    if (milestone.doneAt) health = "done";
    else if (own === null) health = "unscheduled";
    else if (own < today) health = "overdue";
    else if (
      (slack !== null && slack <= 0 && hasOpenSuccessor(id, successors, open)) ||
      (proj !== null && proj > own)
    ) {
      health = "critical";
    } else if (slack !== null && slack < WARNING_SLACK_DAYS) health = "warning";
    else health = "ok";

    result.set(id, {
      id,
      dueAt: own === null ? null : fromDay(own),
      latestAt: bound === null ? null : fromDay(bound),
      slackDays: milestone.doneAt ? null : slack,
      projectedAt: proj === null ? null : fromDay(proj),
      endangeredBy: milestone.doneAt ? [] : endangeredBy,
      health,
    });
  }
  return result;
}

/** Vorschau vor dem Übernehmen: welche Fälligkeiten verschieben sich um wie viele Tage. */
export function diffDueDates(
  before: Map<string, Date | null>,
  after: Map<string, Date | null>,
): { id: string; from: Date | null; to: Date | null; shiftDays: number | null }[] {
  const changes: { id: string; from: Date | null; to: Date | null; shiftDays: number | null }[] =
    [];
  for (const [id, to] of after) {
    const from = before.get(id) ?? null;
    if (from?.getTime() === to?.getTime()) continue;
    changes.push({
      id,
      from,
      to,
      shiftDays: from && to ? toDay(to) - toDay(from) : null,
    });
  }
  return changes;
}

function hasOpenSuccessor(
  id: string,
  successors: Map<string, ScheduleDependency[]>,
  open: Map<string, boolean>,
): boolean {
  // Ein Endpunkt mit Puffer 0 liegt auf der Premiere selbst – das ist nicht kritisch.
  return (successors.get(id) ?? []).some((dep) => open.get(dep.toId));
}

function buildEdges(
  milestones: ScheduleMilestone[],
  dependencies: ScheduleDependency[],
): Map<string, string[]> {
  const ids = new Set(milestones.map((milestone) => milestone.id));
  const edges = new Map<string, string[]>();
  const add = (from: string, to: string) => {
    if (!ids.has(from) || !ids.has(to)) return;
    edges.set(from, [...(edges.get(from) ?? []), to]);
  };
  for (const milestone of milestones) {
    if (milestone.anchorType === "milestone" && milestone.anchorMilestoneId) {
      add(milestone.anchorMilestoneId, milestone.id);
    }
  }
  for (const dep of dependencies) add(dep.fromId, dep.toId);
  return edges;
}

function topologicalOrder(
  milestones: ScheduleMilestone[],
  dependencies: ScheduleDependency[],
): string[] {
  const edges = buildEdges(milestones, dependencies);
  const indegree = new Map(milestones.map((milestone) => [milestone.id, 0]));
  for (const targets of edges.values()) {
    for (const target of targets) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  }
  const queue = milestones.map((m) => m.id).filter((id) => indegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const target of edges.get(id) ?? []) {
      const remaining = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }
  return order;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}
