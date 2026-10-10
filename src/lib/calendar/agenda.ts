import type { AudienceContext } from "@/lib/calendar/audience";

/**
 * Ablauf eines Termins als eine Liste: Szenen, Gewerk-Arbeit und sonstige Programmpunkte.
 * Jeder Punkt hat eine geplante Dauer; die Uhrzeiten ergeben sich der Reihe nach ab Beginn.
 * Reine Funktionen, damit Editor und Tests dasselbe rechnen.
 */

export type AgendaItemType = "SCENE" | "DEPARTMENT" | "CUSTOM";

export type AgendaItem = {
  /** Szenen: `scene:<sceneId>`, sonst die ID des Programmpunkts. */
  id: string;
  type: AgendaItemType;
  sceneId: string | null;
  departmentId: string | null;
  title: string;
  location: string;
  description: string;
  durationMinutes: number;
  /** Angeheftete Uhrzeit (HH:MM) oder leer: dann folgt der Punkt auf den vorherigen. */
  fixedStart: string;
  /** Spur 0 = Hauptspur; höhere Spuren laufen parallel (eigener Raum). */
  track: number;
  /** Gilt für alle Eingeladenen (z. B. Aufwärmen, Auswertung); wartet auf alle Spuren. */
  forEveryone: boolean;
  /** Gewerk-Arbeit: Zeiten hier geändert (sonst behält sie die der Gewerk-Leitung). */
  timesChanged: boolean;
};

export const MAX_TRACKS = 3;
export const DEFAULT_DURATION = 30;
export const DURATION_STEPS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

export type ItemTiming = { start: number; end: number };

export type AgendaTiming = {
  /** Minuten ab Mitternacht des Termintags (über Mitternacht > 1440). */
  times: Record<string, ItemTiming>;
  /** Freie Zeit vor einem angehefteten Punkt. */
  gaps: Record<string, number>;
  /** Angehefteter Punkt beginnt vor dem Ende des vorherigen (Minuten zu knapp). */
  overlaps: Record<string, number>;
  /** Ende des letzten Punkts. */
  end: number;
};

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function toTime(minutes: number) {
  const value = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}′`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}:${String(rest).padStart(2, "0")} h` : `${hours} h`;
}

/** Uhrzeit relativ zum Beginn; Zeiten vor dem Beginn gehören zum Folgetag. */
function anchored(time: string, start: number) {
  const value = toMinutes(time);
  return value < start - 12 * 60 ? value + 1440 : value;
}

/**
 * Uhrzeiten aus Reihenfolge und Dauer. Abschnitte zwischen Punkten „für alle“ haben Spuren, die
 * alle zum Abschnittsbeginn starten; ein Punkt „für alle“ wartet auf die längste Spur.
 */
export function computeAgendaTiming(items: readonly AgendaItem[], startTime: string): AgendaTiming {
  const start = toMinutes(startTime);
  const times: AgendaTiming["times"] = {};
  const gaps: AgendaTiming["gaps"] = {};
  const overlaps: AgendaTiming["overlaps"] = {};
  let segmentStart = start;
  let cursors = new Map<number, number>();

  for (const item of items) {
    const duration = Math.max(0, item.durationMinutes);
    const track = item.forEveryone ? 0 : Math.min(Math.max(item.track, 0), MAX_TRACKS - 1);
    const natural = item.forEveryone
      ? Math.max(segmentStart, ...cursors.values())
      : (cursors.get(track) ?? segmentStart);
    let begin = natural;
    if (item.fixedStart) {
      begin = anchored(item.fixedStart, start);
      if (begin > natural) gaps[item.id] = begin - natural;
      if (begin < natural) overlaps[item.id] = natural - begin;
    }
    const end = begin + duration;
    times[item.id] = { start: begin, end };
    if (item.forEveryone) {
      segmentStart = end;
      cursors = new Map();
    } else {
      cursors.set(track, end);
    }
  }

  const ends = [segmentStart, ...cursors.values(), ...Object.values(times).map((t) => t.end)];
  return { times, gaps, overlaps, end: items.length ? Math.max(...ends) : start };
}

/** Wer an einem Punkt beteiligt ist (ohne „für alle“): Besetzung der Szene, Gewerk. */
export function itemPeople(item: AgendaItem, context: AudienceContext): string[] {
  if (item.type === "SCENE" && item.sceneId) {
    const scene = context.scenes.find((entry) => entry.id === item.sceneId);
    if (!scene) return [];
    const ids = new Set<string>();
    for (const casting of context.castings) {
      if (scene.characterIds.includes(casting.characterId)) ids.add(casting.userId);
    }
    return [...ids];
  }
  if (item.type === "DEPARTMENT" && item.departmentId) {
    return context.departments.find((entry) => entry.id === item.departmentId)?.memberIds ?? [];
  }
  return [];
}

export type PersonSchedule = {
  userId: string;
  /** Minuten in eigenen Punkten (inkl. „für alle“). */
  busy: number;
  /** Persönliches Fenster von erster bis letzter eigener Minute. */
  window: ItemTiming;
  wait: number;
  itemIds: string[];
};

/**
 * Persönliche Fenster: von der ersten bis zur letzten eigenen Minute. Punkte „für alle“ zählen
 * für jeden, der überhaupt einen eigenen Punkt hat; wer keinen hat, kommt zur Terminzeit.
 */
export function computePersonSchedules(
  items: readonly AgendaItem[],
  timing: AgendaTiming,
  context: AudienceContext,
  invitedIds?: ReadonlySet<string>,
): PersonSchedule[] {
  const own = new Map<string, string[]>();
  for (const item of items) {
    if (item.forEveryone) continue;
    for (const userId of itemPeople(item, context)) {
      if (invitedIds && !invitedIds.has(userId)) continue;
      own.set(userId, [...(own.get(userId) ?? []), item.id]);
    }
  }
  const shared = items.filter((item) => item.forEveryone).map((item) => item.id);
  return Array.from(own, ([userId, ownIds]) => {
    const ids = [...ownIds, ...shared];
    const ranges = ids.flatMap((id) => timing.times[id] ?? []);
    const window = {
      start: Math.min(...ranges.map((range) => range.start)),
      end: Math.max(...ranges.map((range) => range.end)),
    };
    const busy = mergedLength(ranges);
    return {
      userId,
      busy,
      window,
      wait: Math.max(0, window.end - window.start - busy),
      itemIds: ids,
    };
  });
}

function mergedLength(ranges: readonly ItemTiming[]) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let total = 0;
  let current: ItemTiming | null = null;
  for (const range of sorted) {
    if (!current || range.start > current.end) {
      if (current) total += current.end - current.start;
      current = { ...range };
    } else {
      current.end = Math.max(current.end, range.end);
    }
  }
  if (current) total += current.end - current.start;
  return total;
}

export type AgendaStats = {
  people: number;
  /** Ø Anteil der Zeit vor Ort, die jemand in eigenen Punkten steckt (0–1). */
  utilization: number;
  longestWait: { userId: string; minutes: number } | null;
  totalWait: number;
};

export function summarizeSchedules(schedules: readonly PersonSchedule[]): AgendaStats {
  if (!schedules.length) {
    return { people: 0, utilization: 1, longestWait: null, totalWait: 0 };
  }
  let utilization = 0;
  let longest: AgendaStats["longestWait"] = null;
  let totalWait = 0;
  for (const entry of schedules) {
    const span = entry.window.end - entry.window.start;
    utilization += span > 0 ? entry.busy / span : 1;
    totalWait += entry.wait;
    if (entry.wait > 0 && (!longest || entry.wait > longest.minutes)) {
      longest = { userId: entry.userId, minutes: entry.wait };
    }
  }
  return {
    people: schedules.length,
    utilization: utilization / schedules.length,
    longestWait: longest,
    totalWait,
  };
}

export type AgendaConflict = { a: string; b: string; userIds: string[] };

/** Gleiche Person in zwei gleichzeitigen Punkten verschiedener Spuren. */
export function findParallelConflicts(
  items: readonly AgendaItem[],
  timing: AgendaTiming,
  context: AudienceContext,
): AgendaConflict[] {
  const conflicts: AgendaConflict[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (!a || !b || a.forEveryone || b.forEveryone || a.track === b.track) continue;
      const ta = timing.times[a.id];
      const tb = timing.times[b.id];
      if (!ta || !tb || ta.start >= tb.end || tb.start >= ta.end) continue;
      const people = new Set(itemPeople(a, context));
      const shared = itemPeople(b, context).filter((id) => people.has(id));
      if (shared.length) conflicts.push({ a: a.id, b: b.id, userIds: shared });
    }
  }
  return conflicts;
}

/** Abschnitt des Ablaufs: entweder ein Punkt „für alle“ oder parallele Spuren. */
export type AgendaSegment =
  | { kind: "shared"; item: AgendaItem }
  | { kind: "tracks"; tracks: { track: number; items: AgendaItem[] }[] };

export function segmentAgenda(items: readonly AgendaItem[]): AgendaSegment[] {
  const segments: AgendaSegment[] = [];
  let current: Map<number, AgendaItem[]> | null = null;
  const flush = () => {
    if (!current) return;
    segments.push({
      kind: "tracks",
      tracks: [...current.entries()]
        .sort(([a], [b]) => a - b)
        .map(([track, list]) => ({ track, items: list })),
    });
    current = null;
  };
  for (const item of items) {
    if (item.forEveryone) {
      flush();
      segments.push({ kind: "shared", item });
      continue;
    }
    current ??= new Map();
    current.set(item.track, [...(current.get(item.track) ?? []), item]);
  }
  flush();
  return segments;
}

export function sceneItemId(sceneId: string) {
  return `scene:${sceneId}`;
}

/** Gespeicherter Ablauf, wie ihn Server und Editor austauschen (siehe `scheduleInputSchema`). */
export type StoredBlock = {
  id: string;
  type: "DEPARTMENT" | "CUSTOM";
  title: string;
  departmentId: string | null;
  start: string;
  end: string;
  location: string;
  description: string;
  timesChanged: boolean;
  durationMinutes: number | null;
  fixedStart: boolean;
  track: number;
  forEveryone: boolean;
};

export type StoredSchedule = {
  mode: "TOGETHER" | "STAGGERED";
  times: Record<string, { start: string; end: string }>;
  rooms: Record<string, string>;
  blocks: StoredBlock[];
  sceneMeta: Record<string, { durationMinutes: number | null; fixedStart: boolean; track: number }>;
  order: string[];
};

function rangeMinutes(start: string, end: string) {
  if (!start || !end) return null;
  const value = toMinutes(end) - toMinutes(start);
  return value > 0 ? value : value + 1440;
}

/** Liste für den Editor: Szenen in Regel-Reihenfolge, gemischt nach gespeicherter Reihenfolge. */
export function agendaFromSchedule(
  schedule: StoredSchedule,
  sceneIds: readonly string[],
  context: Pick<AudienceContext, "scenes">,
): AgendaItem[] {
  const scenes: AgendaItem[] = sceneIds.map((sceneId) => {
    const time = schedule.times[sceneId];
    const meta = schedule.sceneMeta[sceneId];
    const sceneDuration = context.scenes.find((scene) => scene.id === sceneId)?.durationMinutes;
    return {
      id: sceneItemId(sceneId),
      type: "SCENE",
      sceneId,
      departmentId: null,
      title: "",
      location: schedule.rooms[sceneId] ?? "",
      description: "",
      durationMinutes:
        meta?.durationMinutes ??
        rangeMinutes(time?.start ?? "", time?.end ?? "") ??
        (sceneDuration && sceneDuration > 0 ? sceneDuration : DEFAULT_DURATION),
      fixedStart: meta?.fixedStart && time?.start ? time.start : "",
      track: meta?.track ?? 0,
      forEveryone: false,
      timesChanged: false,
    };
  });
  const blocks: AgendaItem[] = schedule.blocks.map((block) => ({
    id: block.id,
    type: block.type,
    sceneId: null,
    departmentId: block.departmentId,
    title: block.title,
    location: block.location,
    description: block.description,
    durationMinutes:
      block.durationMinutes ?? rangeMinutes(block.start, block.end) ?? DEFAULT_DURATION,
    fixedStart: block.fixedStart && block.start ? block.start : "",
    track: block.track,
    forEveryone: block.forEveryone,
    timesChanged: false,
  }));
  const all = [...scenes, ...blocks];
  const position = (id: string) => {
    const index = schedule.order.indexOf(id);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  // Stabil: ohne gespeicherte Reihenfolge bleiben Szenen vor den übrigen Punkten.
  return all
    .map((item, index) => ({ item, index }))
    .sort((a, b) => position(a.item.id) - position(b.item.id) || a.index - b.index)
    .map(({ item }) => item);
}

/** Zurück ins Speicherformat; Uhrzeiten aus der Berechnung. */
export function scheduleFromAgenda(
  items: readonly AgendaItem[],
  timing: AgendaTiming,
  mode: StoredSchedule["mode"],
  initialTimes: ReadonlyMap<string, string> = new Map(),
): StoredSchedule {
  const times: StoredSchedule["times"] = {};
  const rooms: StoredSchedule["rooms"] = {};
  const sceneMeta: StoredSchedule["sceneMeta"] = {};
  const blocks: StoredBlock[] = [];
  for (const item of items) {
    const timed = timing.times[item.id];
    const start = timed ? toTime(timed.start) : "";
    const end = timed ? toTime(timed.end) : "";
    if (item.type === "SCENE" && item.sceneId) {
      if (timed) times[item.sceneId] = { start, end };
      if (item.location.trim()) rooms[item.sceneId] = item.location.trim();
      sceneMeta[item.sceneId] = {
        durationMinutes: item.durationMinutes,
        fixedStart: Boolean(item.fixedStart),
        track: item.track,
      };
      continue;
    }
    if (item.type === "SCENE") continue;
    blocks.push({
      id: item.id,
      type: item.type,
      title: item.title,
      departmentId: item.departmentId,
      start,
      end,
      location: item.location,
      description: item.description,
      timesChanged: item.timesChanged || initialTimes.get(item.id) !== `${start}-${end}`,
      durationMinutes: item.durationMinutes,
      fixedStart: Boolean(item.fixedStart),
      track: item.track,
      forEveryone: item.type === "CUSTOM" && item.forEveryone,
    });
  }
  return { mode, times, rooms, blocks, sceneMeta, order: items.map((item) => item.id) };
}
