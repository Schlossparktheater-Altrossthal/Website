import { progressOf, type CardState, type Progress } from "./schedule";

/** Auswahl und Reihenfolge der Abschnitte (docs/Plan/lernmodus-plan.md); reine Logik. */

/** Neue Abschnitte pro Tag, bevor „Mehr lernen“ nötig ist. */
export const NEW_PER_DAY = 20;
/** Szenen, die in so vielen Tagen geprobt werden, werden vorgezogen. */
export const REHEARSAL_HORIZON_DAYS = 14;
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
  /** Position im Skript (Absatz-Index), für die Reihenfolge. */
  order: number;
};

export type StoredCard = CardState & { textHash: string; createdAt: string };

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
    else if (new Date(stored.due).getTime() <= now) due.push(item);
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
  total: number;
  new: number;
  learning: number;
  solid: number;
  changed: number;
};

export function sceneProgress(input: QueueInput): SceneProgress[] {
  const result = new Map<string, SceneProgress>();
  for (const item of input.items) {
    const entry = result.get(item.sceneId) ?? {
      sceneId: item.sceneId,
      total: 0,
      new: 0,
      learning: 0,
      solid: 0,
      changed: 0,
    };
    const stored = input.cards.get(item.key);
    const changed = isChanged(item, stored);
    const progress: Progress = progressOf(stored ?? null, changed);
    entry.total += 1;
    entry[progress] += 1;
    if (changed) entry.changed += 1;
    result.set(item.sceneId, entry);
  }
  return [...result.values()];
}

/** Anteil 0–1, der „sitzt“ (lernend zählt halb) – für „Sicherheit“ einer Szene. */
export function confidence(progress: Pick<SceneProgress, "total" | "learning" | "solid">) {
  return progress.total ? (progress.solid + progress.learning / 2) / progress.total : 0;
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
