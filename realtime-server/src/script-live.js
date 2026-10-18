/**
 * Live-Mitlesen im Skript-Leser (docs/Plan/skript-mitlesen-plan.md, Phase 2): ein Raum je
 * Fassung. Wer „Andere dürfen mir folgen“ eingeschaltet hat, teilt seine Lesestelle; alle
 * anderen bekommen sie, um zu folgen. Positionen leben nur in `socket.data` (flüchtig, E8); die
 * Teilnehmerliste kommt über `fetchSockets()` und gilt damit über alle Pods (Redis-Adapter).
 */

export const SCRIPT_ROOM_PREFIX = "script_";
const VERSION_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Mindestabstand zwischen zwei Positionen eines Geräts (Client sendet höchstens 1/s). */
const MIN_POSITION_INTERVAL_MS = 250;

function readPoint(value) {
  if (!value || typeof value !== "object") return null;
  const index = Number(value.index);
  const fraction = Number(value.fraction);
  if (!Number.isInteger(index) || index < 0 || index > 100_000) return null;
  if (!Number.isFinite(fraction)) return null;
  return { index, fraction: Math.min(1, Math.max(0, fraction)) };
}

export function createScriptLive({ io, logger = console }) {
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
      live.point = point;
      live.at = now;
      if (!live.followable) return;
      socket.to(live.room).emit("script_live_position", {
        userId: socket.data.userId,
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

  return { attach, emitRoster };
}
