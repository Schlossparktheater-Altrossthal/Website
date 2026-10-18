/**
 * Live-Mitlesen im Skript-Leser (docs/Plan/skript-mitlesen-plan.md, Phase 2): ein Raum je
 * Fassung. Wer „Andere dürfen mir folgen“ eingeschaltet hat, teilt seine Lesestelle; alle
 * anderen bekommen sie, um zu folgen. Positionen leben nur in `socket.data` (flüchtig, E8); die
 * Teilnehmerliste kommt über `fetchSockets()` und gilt damit über alle Pods (Redis-Adapter).
 */

import { hostname } from "node:os";

import { estimate, searchingUntil } from "../../src/lib/skript/live/estimate.js";

export const SCRIPT_ROOM_PREFIX = "script_";
/** Wie oft die Live-Stelle je Raum geschätzt und verteilt wird. */
export const ESTIMATE_INTERVAL_MS = 500;
const LOCK_TTL_MS = 2_000;
const POD_ID = `${hostname()}-${process.pid}`;
const VERSION_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Mindestabstand zwischen zwei Positionen eines Geräts (Client sendet höchstens 1/s). */
const MIN_POSITION_INTERVAL_MS = 250;

function readPoint(value) {
  if (!value || typeof value !== "object") return null;
  const index = Number(value.index);
  const fraction = Number(value.fraction);
  if (!Number.isInteger(index) || index < 0 || index > 100_000) return null;
  if (!Number.isFinite(fraction)) return null;
  const pos = Number(value.pos);
  return {
    index,
    fraction: Math.min(1, Math.max(0, fraction)),
    pos: Number.isFinite(pos) && pos >= 0 ? pos : null,
    // Wer selbst automatisch oder einer Person folgt, zählt nicht für die Schätzung.
    echo: value.echo === true,
  };
}

/**
 * @param {{ io: import("socket.io").Server; logger?: Console; redis?: () => import("ioredis").Redis | null }} options
 */
export function createScriptLive({ io, logger = console, redis = () => null }) {
  const logWarn = typeof logger?.warn === "function" ? (...args) => logger.warn(...args) : () => {};

  async function emitRoster(room) {
    let sockets;
    try {
      sockets = await io.in(room).fetchSockets();
    } catch (error) {
      logWarn("[Realtime] Skript-Teilnehmer nicht abrufbar", error);
      return;
    }
    const readers = new Set();
    const leaders = new Map();
    for (const socket of sockets) {
      const live = socket.data?.scriptLive;
      const userId = socket.data?.userId;
      if (!live || live.room !== room || !userId) continue;
      readers.add(userId);
      if (!live.followable) continue;
      const current = leaders.get(userId);
      // Mehrere Geräte einer Person: das zuletzt bewegte zählt.
      if (current && (current.at ?? 0) >= (live.at ?? 0)) continue;
      leaders.set(userId, {
        userId,
        name: socket.data.userName ?? "Unbekannt",
        deviceId: socket.id,
        index: live.point?.index ?? null,
        fraction: live.point?.fraction ?? null,
        at: live.at ?? null,
      });
    }
    io.to(room).emit("script_live_roster", {
      versionId: room.slice(SCRIPT_ROOM_PREFIX.length),
      readers: readers.size,
      leaders: [...leaders.values()],
    });
  }

  function leave(socket) {
    const live = socket.data?.scriptLive;
    if (!live) return;
    socket.data.scriptLive = null;
    socket.leave(live.room);
    socket.data.rooms?.delete?.(live.room);
    void emitRoster(live.room);
  }

  function attach(socket) {
    socket.on("script_live_join", (payload) => {
      const versionId = payload?.versionId;
      if (typeof versionId !== "string" || !VERSION_ID.test(versionId)) return;
      const room = `${SCRIPT_ROOM_PREFIX}${versionId}`;
      if (socket.data.scriptLive && socket.data.scriptLive.room !== room) leave(socket);
      socket.data.scriptLive = {
        room,
        followable: payload?.followable === true,
        point: socket.data.scriptLive?.point ?? null,
        pos: socket.data.scriptLive?.pos ?? null,
        echo: socket.data.scriptLive?.echo ?? false,
        searchingUntil: 0,
        at: socket.data.scriptLive?.at ?? null,
        sentAt: 0,
      };
      socket.join(room);
      socket.data.rooms?.add?.(room);
      void emitRoster(room);
    });

    socket.on("script_live_update", (payload) => {
      const live = socket.data.scriptLive;
      if (!live) return;
      const followable = payload?.followable === true;
      if (live.followable === followable) return;
      live.followable = followable;
      void emitRoster(live.room);
    });

    socket.on("script_live_position", (payload) => {
      const live = socket.data.scriptLive;
      if (!live) return;
      const point = readPoint(payload);
      if (!point) return;
      const now = Date.now();
      if (now - live.sentAt < MIN_POSITION_INTERVAL_MS) return;
      live.sentAt = now;
      if (point.pos !== null && !point.echo) {
        live.searchingUntil = searchingUntil(
          live.pos !== null && live.at
            ? { pos: live.pos, at: live.at, searchingUntil: live.searchingUntil }
            : null,
          { pos: point.pos, at: now },
        );
      }
      live.point = { index: point.index, fraction: point.fraction };
      live.pos = point.pos;
      live.echo = point.echo;
      live.at = now;
      if (!live.followable) return;
      socket.to(live.room).emit("script_live_position", {
        userId: socket.data.userId,
        // Mehrere Geräte einer Person: Folgende bleiben beim gerade aktiven (use-script-live).
        deviceId: socket.id,
        index: point.index,
        fraction: point.fraction,
        at: now,
      });
    });

    socket.on("script_live_leave", () => leave(socket));
    socket.on("disconnect", () => {
      const live = socket.data?.scriptLive;
      if (!live) return;
      socket.data.scriptLive = null;
      void emitRoster(live.room);
    });
  }

  // ---- Statistische Live-Stelle (Phase 3) ----
  /** Schätzstand je Raum, nur auf dem Pod, der für den Raum gerade rechnet. */
  const states = new Map();

  /** Genau ein Pod rechnet je Raum (E8); ohne Redis ist dieser Pod allein. */
  async function holdsLock(room) {
    const client = redis();
    if (!client) return true;
    const key = `script:live:lock:${room}`;
    try {
      const got = await client.set(key, POD_ID, "PX", LOCK_TTL_MS, "NX");
      if (got === "OK") return true;
      if ((await client.get(key)) !== POD_ID) return false;
      await client.pexpire(key, LOCK_TTL_MS);
      return true;
    } catch (error) {
      logWarn("[Realtime] Skript-Sperre nicht verfügbar", error);
      return false;
    }
  }

  /** Räume mit Mitlesenden auf diesem Pod. */
  function localRooms() {
    const rooms = new Set();
    for (const socket of io.sockets.sockets.values()) {
      const room = socket.data?.scriptLive?.room;
      if (room) rooms.add(room);
    }
    return rooms;
  }

  async function tickRoom(room, now) {
    if (!(await holdsLock(room))) {
      states.delete(room);
      return;
    }
    let sockets;
    try {
      sockets = await io.in(room).fetchSockets();
    } catch (error) {
      logWarn("[Realtime] Skript-Teilnehmer nicht abrufbar", error);
      return;
    }
    // Eine Meldung je Person: das zuletzt bewegte Gerät.
    const byUser = new Map();
    for (const socket of sockets) {
      const live = socket.data?.scriptLive;
      const userId = socket.data?.userId;
      if (!live || live.room !== room || !userId || live.echo || live.pos === null || !live.at) {
        continue;
      }
      const known = byUser.get(userId);
      if (known && known.at >= live.at) continue;
      byUser.set(userId, {
        key: userId,
        pos: live.pos,
        at: live.at,
        leader: live.followable,
        searchingUntil: live.searchingUntil,
      });
    }
    const result = estimate(states.get(room) ?? null, [...byUser.values()], now);
    if (!result) {
      states.delete(room);
      return;
    }
    states.set(room, result.state);
    io.to(room).emit("script_live_estimate", {
      versionId: room.slice(SCRIPT_ROOM_PREFIX.length),
      pos: result.pos,
      rate: result.rate,
      confident: result.confident,
      active: result.active,
      at: now,
    });
  }

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const rooms = localRooms();
      for (const room of states.keys()) if (!rooms.has(room)) states.delete(room);
      const now = Date.now();
      await Promise.all([...rooms].map((room) => tickRoom(room, now)));
    } catch (error) {
      logWarn("[Realtime] Skript-Schätzung fehlgeschlagen", error);
    } finally {
      running = false;
    }
  }, ESTIMATE_INTERVAL_MS);
  timer.unref?.();

  function stop() {
    clearInterval(timer);
    states.clear();
  }

  return { attach, emitRoster, stop };
}
