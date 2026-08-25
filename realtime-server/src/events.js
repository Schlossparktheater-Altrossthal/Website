import { createRealtimeCore } from "../../src/lib/realtime/shared/core.ts";

export function createEventHandlers({ io, logger, toISO }) {
  if (!io) {
    throw new Error("Socket server instance is required");
  }

  const core = createRealtimeCore({ io, logger, toISO });

  const logWarn =
    typeof logger?.warn === "function"
      ? (...args) => logger.warn(...args)
      : (...args) => console.warn(...args);

  function broadcastOnlineStats() {
    core.emitOnlineStatsUpdate({ broadcast: true });
  }

  function emitUserPresence(room, socket, action) {
    core.emitRehearsalPresence({ room, socket, action });
  }

  function emitRehearsalUsersList(rehearsalId, socket) {
    core
      .emitRehearsalUsersList({ rehearsalId, socket })
      .catch((error) => logWarn("[Realtime] Failed to emit rehearsal users list", error));
  }

  function registerUser(socket) {
    const userId = socket.data.userId;
    if (!userId) return;
    const { isFirstConnection } = core.trackConnection({
      userId,
      socketId: socket.id,
      userName: socket.data.userName,
    });
    if (isFirstConnection) {
      core.emitUserJoined({ userId, userName: socket.data.userName, targets: "all" });
    }
    broadcastOnlineStats();
  }

  function unregisterUser(socket) {
    const userId = socket.data.userId;
    if (!userId) return;
    const { isLastConnection, userName } = core.releaseConnection({ userId, socketId: socket.id });
    if (isLastConnection) {
      core.emitUserLeft({ userId, userName: userName ?? socket.data.userName, targets: "all" });
    }
    broadcastOnlineStats();
  }

  function getOnlineStatsSnapshot() {
    const snapshot = core.getOnlineStatsSnapshot();
    return {
      totalOnline: snapshot.totalOnline,
      peakConcurrentUsers: snapshot.peakConcurrentUsers ?? snapshot.totalOnline,
    };
  }

  function isValidRoomIdentifier(room, prefixLength) {
    if (typeof room !== "string") return false;
    if (room.length > 200) return false;
    if (prefixLength >= room.length) return false;
    const identifier = room.slice(prefixLength);
    return /^[A-Za-z0-9_-]+$/.test(identifier);
  }

  function isAllowedRoom(room, socket) {
    if (typeof room !== "string" || !room) return false;
    if (room === "global") return true;
    if (room.startsWith("user_")) {
      const expectedRoom = `user_${socket.data.userId}`;
      return expectedRoom === room;
    }
    if (room.startsWith("rehearsal_")) {
      return isValidRoomIdentifier(room, "rehearsal_".length);
    }
    if (room.startsWith("show_")) {
      return isValidRoomIdentifier(room, "show_".length);
    }
    if (room.startsWith("onboarding_")) {
      return isValidRoomIdentifier(room, "onboarding_".length);
    }
    return false;
  }

  function validateRoom(room, socket) {
    if (!isAllowedRoom(room, socket)) {
      logWarn(`[Realtime] socket ${socket.id} attempted to join unauthorized room: ${room}`);
      return false;
    }
    return true;
  }

  return {
    broadcastOnlineStats,
    emitUserPresence,
    emitRehearsalUsersList,
    registerUser,
    unregisterUser,
    broadcastAttendanceUpdate: core.broadcastAttendanceUpdate,
    broadcastRehearsalCreated: core.broadcastRehearsalCreated,
    broadcastRehearsalUpdated: core.broadcastRehearsalUpdated,
    sendNotification: core.sendNotification,
    broadcastInventoryEvent: core.broadcastInventoryEvent,
    broadcastTicketScanEvent: core.broadcastTicketScanEvent,
    broadcastOnboardingDashboardUpdate: core.broadcastOnboardingDashboardUpdate,
    handleServerEvent: core.handleServerEvent,
    validateRoom,
    getOnlineStatsSnapshot,
  };
}
