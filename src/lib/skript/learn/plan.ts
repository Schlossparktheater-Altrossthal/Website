import {
  SOLID_RETRIEVABILITY,
  progressOf,
  retrievability,
  type CardState,
  type Progress,
} from "./schedule";

/** Auswahl und Reihenfolge der Abschnitte (docs/Plan/lernmodus-plan.md); reine Logik. */

/** Neue Abschnitte pro Tag, bevor „Mehr lernen“ nötig ist. */
export const NEW_PER_DAY = 20;
/** Szenen, die in so vielen Tagen geprobt werden, werden vorgezogen. */
export const REHEARSAL_HORIZON_DAYS = 14;
/** So viele Tage vor einer Probe werden wacklige Abschnitte der Szene aufgefrischt. */
export const REFRESH_BEFORE_DAYS = 2;
/** Zuletzt vor weniger als so vielen Stunden geübt → nicht schon wieder auffrischen. */
const REFRESH_MIN_GAP_HOURS = 12;
/** Geschätzte Sekunden je Abschnitt für „ca. X min“. */
export const SECONDS_PER_ITEM = 15;

export type LearnItem = {
  key: string;
  roleId: string;
  blockId: string;
  lineageId: string;
  sceneId: string;
  chunk: number;
  hash: string;
  words: number;
  /** Wortlaut des Abschnitts (für „was hat sich geändert“). */
  text?: string;
  /** Position im Skript (Absatz-Index), für die Reihenfolge. */
  order: number;
};

export type StoredCard = CardState & {
  textHash: string;
  createdAt: string;
  /** Wortlaut beim letzten Abfragen (fehlt bei älteren Karten). */
  text?: string | null;
};

export function itemKey(roleId: string, lineageId: string, chunk: number) {
  return `${roleId}|${lineageId}|${chunk}`;
}

export function isChanged(item: LearnItem, stored: StoredCard | undefined) {
  return !!stored && stored.textHash !== item.hash;
}

export type QueueInput = {
  items: readonly LearnItem[];
  cards: ReadonlyMap<string, StoredCard>;
  /** Skript-Szene → Datum der nächsten Probe (ISO). */
  rehearsals: ReadonlyMap<string, string>;
  now: Date;
};

function rehearsalRank(input: QueueInput, sceneId: string) {
  const next = input.rehearsals.get(sceneId);
  return next ? new Date(next).getTime() : Number.POSITIVE_INFINITY;
}

/**
 * Vor einer Probe: Abschnitte der Szene, die am Probentag wahrscheinlich nicht mehr sitzen,
 * gelten schon jetzt als fällig (statt erst nach der Probe).
 */
function needsRefresh(input: QueueInput, item: LearnItem, stored: StoredCard) {
  const next = input.rehearsals.get(item.sceneId);
  if (!next) return false;
  const rehearsal = new Date(next);
  const now = input.now.getTime();
  if (rehearsal.getTime() - now > REFRESH_BEFORE_DAYS * 86_400_000) return false;
  const last = stored.lastReview ? new Date(stored.lastReview).getTime() : 0;
  if (now - last < REFRESH_MIN_GAP_HOURS * 3_600_000) return false;
  const at = rehearsal.getTime() > now ? rehearsal : input.now;
  return retrievability(stored, at) < SOLID_RETRIEVABILITY;
}

export type DueSummary = {
  changed: LearnItem[];
  due: LearnItem[];
  fresh: LearnItem[];
  newToday: number;
};

/** Teilt in geänderte, fällige und neue Abschnitte, jeweils schon sortiert. */
export function summarize(input: QueueInput): DueSummary {
  const now = input.now.getTime();
  const changed: LearnItem[] = [];
  const due: LearnItem[] = [];
  const fresh: LearnItem[] = [];
  const startOfDay = new Date(input.now);
  startOfDay.setHours(0, 0, 0, 0);
  let newToday = 0;
  for (const item of input.items) {
    const stored = input.cards.get(item.key);
    if (!stored) {
      fresh.push(item);
      continue;
    }
    if (new Date(stored.createdAt).getTime() >= startOfDay.getTime()) newToday += 1;
    if (isChanged(item, stored)) changed.push(item);
    else if (new Date(stored.due).getTime() <= now || needsRefresh(input, item, stored)) {
      due.push(item);
    }
  }
  const byRehearsal = (a: LearnItem, b: LearnItem) =>
    rehearsalRank(input, a.sceneId) - rehearsalRank(input, b.sceneId) || a.order - b.order;
  changed.sort(byRehearsal);
  due.sort(
    (a, b) =>
      rehearsalRank(input, a.sceneId) - rehearsalRank(input, b.sceneId) ||
      new Date(input.cards.get(a.key)!.due).getTime() -
        new Date(input.cards.get(b.key)!.due).getTime() ||
      a.order - b.order,
  );
  fresh.sort(byRehearsal);
  return { changed, due, fresh, newToday };
}

/**
 * Tagesabfrage: zuerst geänderte Passagen, dann fällige, dann neue bis zum Tageslimit. Neue
 * Abschnitte einer Replik bleiben zusammen und in Skript-Reihenfolge.
 */
export function todayQueue(input: QueueInput) {
  const summary = summarize(input);
  const room = Math.max(0, NEW_PER_DAY - summary.newToday);
  return [...summary.changed, ...summary.due, ...summary.fresh.slice(0, room)];
}

/**
 * „Mehr lernen“ (L5): weitere neue Abschnitte; sind keine mehr da, vorgezogene Wiederholungen
 * (am wenigsten stabile zuerst).
 */
export function moreQueue(input: QueueInput, exclude: ReadonlySet<string>, count = 10) {
  const summary = summarize(input);
  const fresh = summary.fresh.filter((item) => !exclude.has(item.key));
  if (fresh.length) return fresh.slice(0, count);
  return input.items
    .filter((item) => !exclude.has(item.key) && input.cards.has(item.key))
    .sort(
      (a, b) =>
        input.cards.get(a.key)!.stability - input.cards.get(b.key)!.stability || a.order - b.order,
    )
    .slice(0, count);
}

export type SceneProgress = {
  sceneId: string;
  /** Stellen (gemeinsame Repliken und mehrere Rollen zählen einmal). */
  total: number;
  new: number;
  learning: number;
  solid: number;
  changed: number;
  /** Heute fällig (inkl. geändert und Auffrischen vor der Probe). */
  due: number;
};

type UnitState = { sceneId: string; card: StoredCard | null; changed: boolean; due: boolean };

/** Je Stelle (Replik-Abschnitt) die schwächste Rollen-Karte – wie im Lernen selbst. */
function unitStates(input: QueueInput): UnitState[] {
  const { changed, due } = summarize(input);
  const dueKeys = new Set([...changed, ...due].map((item) => item.key));
  const groups = new Map<string, LearnItem[]>();
  for (const item of input.items) {
    const id = `${item.lineageId}|${item.chunk}`;
    groups.set(id, [...(groups.get(id) ?? []), item]);
  }
  return [...groups.values()].map((items) => {
    const cards = items.map((item) => input.cards.get(item.key));
    // Fehlt einer Rolle die Karte, ist die Stelle für sie (und damit insgesamt) neu.
    const card = cards.some((entry) => !entry)
      ? null
      : cards.reduce((weakest, entry) =>
          entry!.stability < weakest!.stability ? entry : weakest,
        )!;
    return {
      sceneId: items[0].sceneId,
      card,
      changed: items.some((item) => isChanged(item, input.cards.get(item.key))),
      due: items.some((item) => dueKeys.has(item.key)),
    };
  });
}

export function sceneProgress(input: QueueInput): SceneProgress[] {
  const result = new Map<string, SceneProgress>();
  for (const unit of unitStates(input)) {
    const entry = result.get(unit.sceneId) ?? {
      sceneId: unit.sceneId,
      total: 0,
      new: 0,
      learning: 0,
      solid: 0,
      changed: 0,
      due: 0,
    };
    const progress: Progress = progressOf(unit.card, unit.changed, input.now);
    entry.total += 1;
    entry[progress] += 1;
    if (unit.changed) entry.changed += 1;
    if (unit.due) entry.due += 1;
    result.set(unit.sceneId, entry);
  }
  return [...result.values()];
}

/**
 * Sicherheit 0–1: mittlere Wahrscheinlichkeit, die Stellen zum Zeitpunkt `at` zu können (neu = 0,
 * geändert höchstens halb). Mit dem Probentermin als `at` = Prognose für die Probe.
 */
export function confidence(input: QueueInput, at: Date = input.now, sceneId?: string) {
  const units = unitStates(input).filter((unit) => !sceneId || unit.sceneId === sceneId);
  if (!units.length) return 0;
  const sum = units.reduce((total, unit) => {
    const value = retrievability(unit.card, at);
    return total + (unit.changed ? Math.min(value, 0.5) : value);
  }, 0);
  return sum / units.length;
}

/** Montag 0:00 der Woche von `date` (Ortszeit). */
export function weekStart(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Lerntage der laufenden Woche (Mo–So) als Liste von 7 Wahrheitswerten. */
export function weekDays(studyDays: ReadonlySet<string>, now: Date) {
  const start = weekStart(now);
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    return studyDays.has(dayKey(day));
  });
}

/**
 * Szenen-Zuordnung Stück ↔ Skript: zuerst gleicher Titel (normalisiert, auch „enthält“), dann
 * gleiche Szenennummer, bei gleicher Anzahl notfalls die Reihenfolge.
 */
export function matchScenes(
  stage: readonly { id: string; title: string | null; identifier: string | null }[],
  script: readonly { id: string; title: string }[],
) {
  const norm = (text: string) =>
    text
      .toLocaleLowerCase("de")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\b(szene|bild|akt|scene)\b/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const number = (text: string | null) => text?.match(/\d+(?:\.\d+)?/)?.[0] ?? null;
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const scene of stage) {
    const title = scene.title ? norm(scene.title) : "";
    const hit = title
      ? script.find((candidate) => {
          if (used.has(candidate.id)) return false;
          const other = norm(candidate.title);
          return (
            other.length > 2 &&
            title.length > 2 &&
            (other === title || other.includes(title) || title.includes(other))
          );
        })
      : undefined;
    if (hit) {
      result.set(scene.id, hit.id);
      used.add(hit.id);
    }
  }
  for (const scene of stage) {
    if (result.has(scene.id)) continue;
    const own = number(scene.identifier);
    if (!own) continue;
    const hit = script.find(
      (candidate) => !used.has(candidate.id) && number(candidate.title) === own,
    );
    if (hit) {
      result.set(scene.id, hit.id);
      used.add(hit.id);
    }
  }
  if (!result.size && stage.length === script.length) {
    stage.forEach((scene, index) => result.set(scene.id, script[index].id));
  }
  return result;
}
