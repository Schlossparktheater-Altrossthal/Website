import { fromAxis, type LiveAxis } from "./axis";

/**
 * Protokoll aus den Messpunkten einer Aufnahme (docs/Plan/skript-mitlesen-plan.md, Phase 7/8):
 * Szenen brutto/netto, Wiederholungen, Stillstände/Pausen, Übersprungenes, Probenart und
 * welche Rollen dabei waren. Rein und ohne Datenbank – gleich für gemeinsame und private Aufnahmen.
 */

export type ProtocolSample = { at: number; pos: number; active?: number; roleIds?: string[] };

export type ProtocolInput = {
  samples: ProtocolSample[];
  axis: LiveAxis;
  /** Szene je Absatz (Index wie in der Achse). */
  blockScenes: string[];
  scenes: { id: string; title: string }[];
  /** Sprechende Rollen je Szene (für „fehlte“). Leer = nicht auswerten (privat). */
  sceneRoles?: Record<string, string[]>;
};

/** Abstand ohne Messpunkt, ab dem die Aufnahme als unterbrochen gilt (Lücke). */
export const GAP_MS = 60_000;
/** Weniger Bewegung gilt als Stillstand. */
export const STILL_CHARS = 15;
/** Stillstand ab dieser Dauer wird festgehalten (Nachfrage, Gespräch). */
export const STOP_MS = 30_000;
/** Stillstand ab dieser Dauer ist eine Pause. */
export const PAUSE_MS = 5 * 60_000;
/** Schneller als das ist kein Lesen mehr, sondern ein Sprung nach vorn. */
export const MAX_READ_CPS = 45;
/** Rücksprung ab so vielen Zeichen = Wiederholung. */
export const REPEAT_CHARS = 150;
/** Kürzere Abschnitte werden dem vorigen zugeschlagen. */
export const MIN_SEGMENT_MS = 20_000;

export type ProtocolStop = {
  at: number;
  pos: number;
  blockIndex: number;
  sceneId: string | null;
  seconds: number;
  pause: boolean;
};

export type ProtocolRepeat = {
  at: number;
  /** Zurück von … nach … (Achse). */
  from: number;
  to: number;
  blockIndex: number;
  sceneId: string | null;
};

export type ProtocolSegment = {
  sceneId: string | null;
  start: number;
  end: number;
  /** Bereich auf der Achse, der in diesem Abschnitt gelesen wurde. */
  fromPos: number;
  toPos: number;
  repeats: number;
  stops: number;
};

export type ProtocolScene = {
  sceneId: string;
  title: string;
  /** Zeit in der Szene inkl. Stillstände, ohne Pausen und Lücken (s). */
  grossSeconds: number;
  /** Davon vorwärts gelesen (s). */
  netSeconds: number;
  repeats: number;
  stops: number;
  /** Anteil der Szene, der gelesen wurde (0–1). */
  coverage: number;
  presentRoleIds: string[];
  missingRoleIds: string[];
};

export type ProtocolKind = "durchlauf" | "leseprobe" | "szenenarbeit";

export type Protocol = {
  start: number;
  end: number;
  totalSeconds: number;
  readingSeconds: number;
  stopSeconds: number;
  pauseSeconds: number;
  gapSeconds: number;
  kind: ProtocolKind | null;
  segments: ProtocolSegment[];
  scenes: ProtocolScene[];
  stops: ProtocolStop[];
  repeats: ProtocolRepeat[];
  /** Übersprungene Bereiche (Achse), die auch später nicht gelesen wurden. */
  skipped: { from: number; to: number; sceneIds: string[] }[];
  /** Höchste Zahl gleichzeitig aktiv Mitlesender. */
  maxActive: number;
};

type Range = [number, number];

function addRange(ranges: Range[], from: number, to: number) {
  if (to <= from) return;
  ranges.push([from, to]);
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const [from, to] of sorted) {
    const last = merged[merged.length - 1];
    // Kleine Lücken (unter einem Stillstand) gelten als gelesen.
    if (last && from <= last[1] + STILL_CHARS) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  return merged;
}

function overlap(ranges: Range[], from: number, to: number) {
  let sum = 0;
  for (const [a, b] of ranges) sum += Math.max(0, Math.min(b, to) - Math.max(a, from));
  return sum;
}

export function classifyKind(input: {
  readingSeconds: number;
  stopSeconds: number;
  repeats: number;
}): ProtocolKind | null {
  const active = input.readingSeconds + input.stopSeconds;
  if (active < 120) return null;
  const stopShare = input.stopSeconds / active;
  const perHour = input.repeats / (active / 3600);
  if (stopShare < 0.15 && perHour < 3) return "durchlauf";
  if (stopShare > 0.4 || perHour >= 10) return "szenenarbeit";
  return "leseprobe";
}

export function buildProtocol(input: ProtocolInput): Protocol | null {
  const samples = [...input.samples]
    .filter((sample) => Number.isFinite(sample.at) && Number.isFinite(sample.pos))
    .sort((a, b) => a.at - b.at);
  if (!samples.length) return null;
  const { axis, blockScenes } = input;
  const blockAt = (pos: number) => fromAxis(axis, pos).index;
  const sceneAt = (pos: number) => blockScenes[blockAt(pos)] ?? null;
  const sceneRange = new Map<string, Range>();
  blockScenes.forEach((sceneId, index) => {
    const from = axis.starts[index] ?? 0;
    const to = from + (axis.lengths[index] ?? 0);
    const known = sceneRange.get(sceneId);
    if (known) known[1] = Math.max(known[1], to);
    else sceneRange.set(sceneId, [from, to]);
  });

  const read: Range[] = [];
  const jumps: Range[] = [];
  const stops: ProtocolStop[] = [];
  const repeats: ProtocolRepeat[] = [];
  const gross = new Map<string, number>();
  const net = new Map<string, number>();
  const present = new Map<string, Set<string>>();
  /** Zeitabschnitte je Szene, vor dem Zusammenfassen. */
  const pieces: ProtocolSegment[] = [];
  let readingMs = 0;
  let stopMs = 0;
  let pauseMs = 0;
  let gapMs = 0;
  let maxActive = 0;
  let still: { at: number; pos: number; ms: number } | null = null;

  const closeStill = () => {
    if (!still) return;
    const stillScene = sceneAt(still.pos);
    // Brutto zählt Stillstände mit, Pausen nicht.
    if (stillScene && still.ms < PAUSE_MS) {
      gross.set(stillScene, (gross.get(stillScene) ?? 0) + still.ms);
    }
    if (still.ms >= STOP_MS) {
      const pause = still.ms >= PAUSE_MS;
      stops.push({
        at: still.at,
        pos: still.pos,
        blockIndex: blockAt(still.pos),
        sceneId: sceneAt(still.pos),
        seconds: Math.round(still.ms / 1000),
        pause,
      });
      if (pause) pauseMs += still.ms;
      else stopMs += still.ms;
      const piece = pieces[pieces.length - 1];
      if (piece && !pause) piece.stops += 1;
    } else {
      // Kurzes Innehalten zählt als Lesen.
      readingMs += still.ms;
      if (stillScene) net.set(stillScene, (net.get(stillScene) ?? 0) + still.ms);
    }
    still = null;
  };

  const addPiece = (
    sceneId: string | null,
    start: number,
    end: number,
    from: number,
    to: number,
  ) => {
    const last = pieces[pieces.length - 1];
    if (last && last.sceneId === sceneId && last.end === start) {
      last.end = end;
      last.fromPos = Math.min(last.fromPos, from);
      last.toPos = Math.max(last.toPos, to);
      return;
    }
    pieces.push({ sceneId, start, end, fromPos: from, toPos: to, repeats: 0, stops: 0 });
  };

  for (const sample of samples) maxActive = Math.max(maxActive, sample.active ?? 0);

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    const ms = next.at - prev.at;
    if (ms <= 0) continue;
    if (ms > GAP_MS) {
      closeStill();
      gapMs += ms;
      continue;
    }
    const delta = next.pos - prev.pos;
    const sceneId = sceneAt(prev.pos);
    const roleIds = prev.roleIds ?? [];
    if (sceneId && roleIds.length) {
      const set = present.get(sceneId) ?? new Set<string>();
      for (const roleId of roleIds) set.add(roleId);
      present.set(sceneId, set);
    }

    if (Math.abs(delta) < STILL_CHARS) {
      if (!still) still = { at: prev.at, pos: prev.pos, ms: 0 };
      still.ms += ms;
      addPiece(sceneId, prev.at, next.at, prev.pos, prev.pos);
      continue;
    }
    closeStill();
    if (delta < 0) {
      if (-delta >= REPEAT_CHARS) {
        repeats.push({
          at: next.at,
          from: prev.pos,
          to: next.pos,
          blockIndex: blockAt(next.pos),
          sceneId: sceneAt(next.pos),
        });
        addPiece(sceneAt(next.pos), prev.at, next.at, next.pos, next.pos);
        const piece = pieces[pieces.length - 1];
        piece.repeats += 1;
      } else {
        // Kurz zurück (Zeile nachlesen) zählt zur Szene, nicht als Wiederholung.
        if (sceneId) gross.set(sceneId, (gross.get(sceneId) ?? 0) + ms);
        addPiece(sceneId, prev.at, next.at, next.pos, prev.pos);
      }
      continue;
    }
    if (delta / (ms / 1000) > MAX_READ_CPS) {
      addRange(jumps, prev.pos, next.pos);
      addPiece(sceneAt(next.pos), prev.at, next.at, next.pos, next.pos);
      continue;
    }
    addRange(read, prev.pos, next.pos);
    readingMs += ms;
    // Über eine Szenengrenze: Zeit anteilig aufteilen.
    const nextScene = sceneAt(next.pos);
    if (sceneId && nextScene && nextScene !== sceneId) {
      const border = sceneRange.get(nextScene)?.[0] ?? next.pos;
      const share = Math.min(1, Math.max(0, (border - prev.pos) / delta));
      const first = Math.round(ms * share);
      gross.set(sceneId, (gross.get(sceneId) ?? 0) + first);
      net.set(sceneId, (net.get(sceneId) ?? 0) + first);
      gross.set(nextScene, (gross.get(nextScene) ?? 0) + ms - first);
      net.set(nextScene, (net.get(nextScene) ?? 0) + ms - first);
      addPiece(sceneId, prev.at, prev.at + first, prev.pos, border);
      addPiece(nextScene, prev.at + first, next.at, border, next.pos);
    } else if (sceneId) {
      gross.set(sceneId, (gross.get(sceneId) ?? 0) + ms);
      net.set(sceneId, (net.get(sceneId) ?? 0) + ms);
      addPiece(sceneId, prev.at, next.at, prev.pos, next.pos);
    }
  }
  closeStill();

  // Kurze Abschnitte dem vorigen zuschlagen, gleiche Szenen danach verbinden.
  const segments: ProtocolSegment[] = [];
  for (const piece of pieces) {
    const last = segments[segments.length - 1];
    if (last && (last.sceneId === piece.sceneId || piece.end - piece.start < MIN_SEGMENT_MS)) {
      last.end = piece.end;
      if (last.sceneId === piece.sceneId) {
        last.fromPos = Math.min(last.fromPos, piece.fromPos);
        last.toPos = Math.max(last.toPos, piece.toPos);
      }
      last.repeats += piece.repeats;
      last.stops += piece.stops;
    } else {
      segments.push({ ...piece });
    }
  }

  const readMerged = mergeRanges(read);
  const skipped = mergeRanges(jumps)
    .flatMap(([from, to]) => {
      // Was später doch gelesen wurde, ist nicht übersprungen.
      const parts: Range[] = [];
      let cursor = from;
      for (const [a, b] of readMerged) {
        if (b <= cursor || a >= to) continue;
        if (a > cursor) parts.push([cursor, a]);
        cursor = Math.max(cursor, b);
      }
      if (cursor < to) parts.push([cursor, to]);
      return parts;
    })
    .filter(([from, to]) => to - from >= REPEAT_CHARS)
    .map(([from, to]) => {
      const sceneIds = new Set<string>();
      for (const [id, [a, b]] of sceneRange) if (a < to && b > from) sceneIds.add(id);
      return { from, to, sceneIds: [...sceneIds] };
    });

  const sceneRoles = input.sceneRoles ?? {};
  const scenes: ProtocolScene[] = input.scenes
    .filter((scene) => (gross.get(scene.id) ?? 0) > 0 || (net.get(scene.id) ?? 0) > 0)
    .map((scene) => {
      const range = sceneRange.get(scene.id) ?? [0, 0];
      const length = range[1] - range[0];
      const presentIds = [...(present.get(scene.id) ?? [])];
      const speaking = sceneRoles[scene.id] ?? [];
      return {
        sceneId: scene.id,
        title: scene.title,
        grossSeconds: Math.round((gross.get(scene.id) ?? 0) / 1000),
        netSeconds: Math.round((net.get(scene.id) ?? 0) / 1000),
        repeats: repeats.filter((repeat) => repeat.sceneId === scene.id).length,
        stops: stops.filter((stop) => !stop.pause && stop.sceneId === scene.id).length,
        coverage: length > 0 ? Math.min(1, overlap(readMerged, range[0], range[1]) / length) : 0,
        presentRoleIds: presentIds,
        missingRoleIds: presentIds.length
          ? speaking.filter((roleId) => !presentIds.includes(roleId))
          : [],
      };
    });

  const start = samples[0].at;
  const end = samples[samples.length - 1].at;
  const readingSeconds = Math.round(readingMs / 1000);
  const stopSeconds = Math.round(stopMs / 1000);
  return {
    start,
    end,
    totalSeconds: Math.round((end - start) / 1000),
    readingSeconds,
    stopSeconds,
    pauseSeconds: Math.round(pauseMs / 1000),
    gapSeconds: Math.round(gapMs / 1000),
    kind: classifyKind({ readingSeconds, stopSeconds, repeats: repeats.length }),
    segments,
    scenes,
    stops,
    repeats,
    skipped,
    maxActive,
  };
}
