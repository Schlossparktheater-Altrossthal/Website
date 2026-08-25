function defaultToISO(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function normalizeDateInput(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  return new Date();
}

function createEmitter(io, room, excludeSocketId) {
  const baseEmitter = io.to(room);
  if (!excludeSocketId || typeof baseEmitter?.except !== "function") {
    return baseEmitter;
  }
  return baseEmitter.except(excludeSocketId);
}

export function createRealtimeCore(options = {}) {
  const { io, logger = console, toISO = defaultToISO, trackPresenceEvent } = options;

  if (!io) {
    throw new Error("Socket server instance is required");
  }

  const logError =
    typeof logger?.error === "function"
      ? (...args) => logger.error(...args)
      : (...args) => console.error(...args);
  const logWarn =
    typeof logger?.warn === "function"
      ? (...args) => logger.warn(...args)
      : (...args) => console.warn(...args);

  const formatTimestamp = (value) => {
    const date = normalizeDateInput(value ?? Date.now());
    try {
      return toISO(date);
    } catch (error) {
      logWarn("[Realtime] Failed to format timestamp via custom formatter", error);
      return date.toISOString();
    }
  };

  const connectedUsers = new Map();
  const onlineStatsSubscribers = new Set();
  let peakConcurrentUsers = 0;

  function trackConnection({ userId, socketId, userName, lastSeen }) {
    if (!userId || !socketId) {
      return { isFirstConnection: false };
    }

    const seenAt = normalizeDateInput(lastSeen ?? Date.now()).getTime();
    const existing = connectedUsers.get(userId);
    if (!existing) {
      connectedUsers.set(userId, {
        sockets: new Set([socketId]),
        name: userName,
        lastSeen: seenAt,
      });
      if (connectedUsers.size > peakConcurrentUsers) {
        peakConcurrentUsers = connectedUsers.size;
      }
      return { isFirstConnection: true, userName };
    }

    existing.sockets.add(socketId);
    if (userName) {
      existing.name = userName;
    }
    existing.lastSeen = seenAt;
    return { isFirstConnection: false, userName: existing.name };
  }

  function releaseConnection({ userId, socketId }) {
    if (!userId || !socketId) {
      return { isLastConnection: false };
    }

    const entry = connectedUsers.get(userId);
    if (!entry) {
      return { isLastConnection: false };
    }

    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) {
      connectedUsers.delete(userId);
      return { isLastConnection: true, userName: entry.name };
    }

    entry.lastSeen = Date.now();
    return { isLastConnection: false, userName: entry.name };
  }

  function addOnlineStatsSubscriber(socketId) {
    if (!socketId) return;
    onlineStatsSubscribers.add(socketId);
  }

  function removeOnlineStatsSubscriber(socketId) {
    if (!socketId) return;
    onlineStatsSubscribers.delete(socketId);
  }

  function emitToTargets(eventName, payload, targets = "subscribers") {
    if (targets === "all") {
      io.emit(eventName, payload);
      return;
    }

    const ids =
      !targets || targets === "subscribers"
        ? Array.from(onlineStatsSubscribers)
        : Array.from(targets).filter((id) => typeof id === "string");

    ids.forEach((socketId) => {
      const recipient = io.sockets.sockets.get(socketId);
      if (recipient) {
        recipient.emit(eventName, payload);
      } else if (!targets || targets === "subscribers") {
        onlineStatsSubscribers.delete(socketId);
      }
    });
  }

  function emitOnlineStatsUpdate(options = {}) {
    const { targetSocket, broadcast = false } = options;
    const event = {
      type: "online_stats_update",
      timestamp: formatTimestamp(),
      stats: getOnlineStatsSnapshot(),
    };

    if (targetSocket) {
      targetSocket.emit("online_stats_update", event);
      return;
    }

    if (broadcast) {
      io.emit("online_stats_update", event);
      return;
    }

    emitToTargets("online_stats_update", event, "subscribers");
  }

  function emitUserJoined({ userId, userName, targets }) {
    if (!userId) return;
    const event = {
      type: "user_joined",
      timestamp: formatTimestamp(),
      user: { id: userId, name: userName },
    };
    emitToTargets("user_joined", event, targets ?? "subscribers");
  }

  function emitUserLeft({ userId, userName, targets }) {
    if (!userId) return;
    const event = {
      type: "user_left",
      timestamp: formatTimestamp(),
      user: { id: userId, name: userName },
    };
    emitToTargets("user_left", event, targets ?? "subscribers");
  }

  function emitRehearsalPresence({ room, socket, action }) {
    if (!room || typeof room !== "string") return;
    if (!room.startsWith("rehearsal_")) return;

    const userId = socket?.data?.userId;
    const userName = socket?.data?.userName;
    if (!userId || !userName) {
      return;
    }

    const occurredAt = new Date();
    const payload = {
      type: "user_presence",
      timestamp: formatTimestamp(occurredAt),
      action,
      room,
      user: {
        id: userId,
        name: userName,
      },
    };

    if (typeof trackPresenceEvent === "function") {
      try {
        const result = trackPresenceEvent({ userId, room, action, occurredAt });
        if (result && typeof result.catch === "function") {
          result.catch((error) => logError("[Realtime] Failed to track presence event", error));
        }
      } catch (error) {
        logError("[Realtime] Failed to track presence event", error);
      }
    }

    const emitter = socket?.to?.(room);
    emitter?.emit?.("user_presence", payload);
  }

  async function emitRehearsalUsersList({ rehearsalId, socket }) {
    if (!rehearsalId || !socket) return;
    const roomName = `rehearsal_${rehearsalId}`;

    let participants;
    try {
      if (typeof io.in === "function" && typeof io.in(roomName).fetchSockets === "function") {
        // fetchSockets() works across instances when a Redis (or other
        // distributed) adapter is configured, unlike the local adapter rooms map.
        participants = await io.in(roomName).fetchSockets();
      } else {
        const room = io.sockets.adapter.rooms.get(roomName);
        participants = room
          ? Array.from(room)
              .map((socketId) => io.sockets.sockets.get(socketId))
              .filter(Boolean)
          : [];
      }
    } catch (error) {
      logError("[Realtime] Failed to fetch rehearsal users", error);
      return;
    }

    const users = participants.flatMap((participant) => {
      if (!participant?.data?.userId) {
        return [];
      }
      return [
        {
          id: participant.data.userId,
          name: participant.data.userName,
        },
      ];
    });

    socket.emit("rehearsal_users_list", {
      type: "rehearsal_users_list",
      timestamp: formatTimestamp(),
      rehearsalId,
      users,
    });
  }

  function broadcast(event, rooms, excludeSocketId) {
    if (!event || !rooms) return false;
    const roomArray = Array.isArray(rooms) ? rooms : [rooms];
    roomArray
      .filter((room) => typeof room === "string" && room)
      .forEach((room) => {
        const emitter = createEmitter(io, room, excludeSocketId);
        emitter?.emit?.(event.type, event);
      });
    return true;
  }

  function broadcastAttendanceUpdate(payload) {
    if (!payload || !payload.rehearsalId) return false;
    const event = {
      type: "attendance_updated",
      rehearsalId: payload.rehearsalId,
      targetUserId: payload.targetUserId,
      status: payload.status ?? null,
      comment: payload.comment,
      actorUserId: payload.actorUserId,
      timestamp: formatTimestamp(),
    };

    broadcast(event, `rehearsal_${payload.rehearsalId}`);
    if (payload.targetUserId) {
      broadcast(event, `user_${payload.targetUserId}`);
    }
    return true;
  }

  function broadcastRehearsalCreated(payload) {
    if (!payload || !payload.rehearsal) return false;
    const event = {
      type: "rehearsal_created",
      rehearsal: payload.rehearsal,
      targetUserIds: Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [],
      timestamp: formatTimestamp(),
    };

    if (event.targetUserIds.length > 0) {
      event.targetUserIds.forEach((userId) => {
        broadcast(event, `user_${userId}`);
      });
    } else {
      io.emit("rehearsal_created", event);
    }
    return true;
  }

  function broadcastRehearsalUpdated(payload, options = {}) {
    if (!payload || !payload.rehearsalId) return false;
    const event = {
      type: "rehearsal_updated",
      rehearsalId: payload.rehearsalId,
      changes: payload.changes || {},
      targetUserIds: Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [],
      timestamp: formatTimestamp(options.timestamp ?? Date.now()),
    };

    broadcast(event, `rehearsal_${payload.rehearsalId}`);
    event.targetUserIds.forEach((userId) => {
      broadcast(event, `user_${userId}`);
    });
    return true;
  }

  function sendNotification(payload, options = {}) {
    if (!payload || !payload.targetUserId || !payload.notification) return false;
    const event = {
      type: "notification_created",
      notification: payload.notification,
      targetUserId: payload.targetUserId,
      timestamp: formatTimestamp(options.timestamp ?? Date.now()),
    };

    broadcast(event, `user_${payload.targetUserId}`);
    return true;
  }

  function broadcastInventoryEvent(payload, options = {}) {
    if (!payload || typeof payload !== "object") return false;
    const event = {
      type: "inventory_event",
      payload,
      timestamp: formatTimestamp(options.timestamp ?? Date.now()),
    };

    const rooms = options.rooms ?? ["global"];
    broadcast(event, rooms, options.excludeSocketId);
    return true;
  }

  function broadcastTicketScanEvent(payload, options = {}) {
    if (!payload || typeof payload !== "object") return false;
    const event = {
      type: "ticket_scan_event",
      payload,
      timestamp: formatTimestamp(options.timestamp ?? Date.now()),
    };

    const rooms = options.rooms ?? ["global"];
    broadcast(event, rooms, options.excludeSocketId);

    const showId = typeof payload.showId === "string" ? payload.showId.trim() : "";
    if (showId) {
      broadcast(event, `show_${showId}`, options.excludeSocketId);
    }

    return true;
  }

  function broadcastOnboardingDashboardUpdate(payload, options = {}) {
    if (!payload || typeof payload !== "object") return false;
    const { onboardingId, dashboard } = payload;
    if (typeof onboardingId !== "string" || !onboardingId.trim()) return false;
    if (!dashboard || typeof dashboard !== "object") return false;

    const event = {
      type: "onboarding_dashboard_update",
      onboardingId,
      dashboard,
      timestamp: formatTimestamp(options.timestamp ?? Date.now()),
    };

    broadcast(event, `onboarding_${onboardingId}`);
    if (payload.broadcastToGlobal) {
      broadcast(event, "global");
    }
    return true;
  }

  function handleServerEvent(eventType, data) {
    switch (eventType) {
      case "attendance_updated":
        return broadcastAttendanceUpdate(data);
      case "rehearsal_created":
        return broadcastRehearsalCreated(data);
      case "rehearsal_updated":
        return broadcastRehearsalUpdated(data);
      case "notification_created":
        return sendNotification(data);
      case "inventory_event":
        return broadcastInventoryEvent(data);
      case "ticket_scan_event":
        return broadcastTicketScanEvent(data);
      case "onboarding_dashboard_update":
        return broadcastOnboardingDashboardUpdate(data);
      default:
        return false;
    }
  }

  function getOnlineStatsSnapshot() {
    return {
      totalOnline: connectedUsers.size,
      peakConcurrentUsers,
      onlineUsers: Array.from(connectedUsers.entries()).map(([id, info]) => ({
        id,
        name: info.name,
        lastSeen: info.lastSeen ? formatTimestamp(info.lastSeen) : undefined,
      })),
    };
  }

  function clearSocket(socketId) {
    removeOnlineStatsSubscriber(socketId);
    if (!socketId) return;
    for (const [userId, entry] of connectedUsers.entries()) {
      if (entry.sockets.delete(socketId) && entry.sockets.size === 0) {
        connectedUsers.delete(userId);
      }
    }
  }

  return {
    io,
    trackConnection,
    releaseConnection,
    addOnlineStatsSubscriber,
    removeOnlineStatsSubscriber,
    emitOnlineStatsUpdate,
    emitUserJoined,
    emitUserLeft,
    emitRehearsalPresence,
    emitRehearsalUsersList,
    broadcast,
    broadcastAttendanceUpdate,
    broadcastRehearsalCreated,
    broadcastRehearsalUpdated,
    sendNotification,
    broadcastInventoryEvent,
    broadcastTicketScanEvent,
    broadcastOnboardingDashboardUpdate,
    handleServerEvent,
    getOnlineStatsSnapshot,
    get connectedUsers() {
      return connectedUsers;
    },
    get peakConcurrentUsers() {
      return peakConcurrentUsers;
    },
    emitToTargets,
    clearSocket,
    formatTimestamp,
  };
}
