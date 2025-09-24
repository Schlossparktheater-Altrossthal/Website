export function createEventHandlers({ io, logger, toISO }) {
  if (!io) {
    throw new Error('Socket server instance is required');
  }

  const formatTimestamp = typeof toISO === 'function' ? toISO : (value) => new Date(value).toISOString();
  const logWarn =
    typeof logger?.warn === 'function' ? (...args) => logger.warn(...args) : (...args) => console.warn(...args);

  const onlineUsers = new Map();

  function broadcastOnlineStats() {
    const snapshot = {
      totalOnline: onlineUsers.size,
      onlineUsers: Array.from(onlineUsers.entries()).map(([userId, info]) => ({
        id: userId,
        name: info.name,
        lastSeen: formatTimestamp(info.lastSeen),
      })),
    };

    io.emit('online_stats_update', {
      type: 'online_stats_update',
      timestamp: formatTimestamp(Date.now()),
      stats: snapshot,
    });
  }

  function emitUserPresence(room, socket, action) {
    const userId = socket.data.userId;
    if (!userId) return;
    const payload = {
      type: 'user_presence',
      timestamp: formatTimestamp(Date.now()),
      action,
      room,
      user: {
        id: userId,
        name: socket.data.userName,
      },
    };
    socket.to(room).emit('user_presence', payload);
  }

  function emitRehearsalUsersList(rehearsalId, socket) {
    const roomName = `rehearsal_${rehearsalId}`;
    const room = io.sockets.adapter.rooms.get(roomName);
    if (!room) {
      socket.emit('rehearsal_users_list', {
        type: 'rehearsal_users_list',
        timestamp: formatTimestamp(Date.now()),
        rehearsalId,
        users: [],
      });
      return;
    }

    const users = [];
    for (const socketId of room) {
      const member = io.sockets.sockets.get(socketId);
      if (member?.data?.userId) {
        users.push({
          id: member.data.userId,
          name: member.data.userName,
        });
      }
    }

    socket.emit('rehearsal_users_list', {
      type: 'rehearsal_users_list',
      timestamp: formatTimestamp(Date.now()),
      rehearsalId,
      users,
    });
  }

  function registerUser(socket) {
    const userId = socket.data.userId;
    const name = socket.data.userName;
    const existing = onlineUsers.get(userId);
    if (existing) {
      existing.sockets.add(socket.id);
      existing.lastSeen = Date.now();
    } else {
      onlineUsers.set(userId, {
        name,
        lastSeen: Date.now(),
        sockets: new Set([socket.id]),
      });
      io.emit('user_joined', {
        type: 'user_joined',
        timestamp: formatTimestamp(Date.now()),
        user: { id: userId, name },
      });
    }
    broadcastOnlineStats();
  }

  function unregisterUser(socket) {
    const userId = socket.data.userId;
    const existing = onlineUsers.get(userId);
    if (!existing) return;

    existing.sockets.delete(socket.id);
    if (existing.sockets.size === 0) {
      onlineUsers.delete(userId);
      io.emit('user_left', {
        type: 'user_left',
        timestamp: formatTimestamp(Date.now()),
        user: { id: userId, name: socket.data.userName },
      });
    } else {
      existing.lastSeen = Date.now();
    }
    broadcastOnlineStats();
  }

  function broadcastAttendanceUpdate(payload) {
    if (!payload || !payload.rehearsalId) return false;
    const event = {
      type: 'attendance_updated',
      rehearsalId: payload.rehearsalId,
      targetUserId: payload.targetUserId,
      status: payload.status ?? null,
      comment: payload.comment,
      actorUserId: payload.actorUserId,
      timestamp: formatTimestamp(Date.now()),
    };

    io.to(`rehearsal_${payload.rehearsalId}`).emit('attendance_updated', event);
    if (payload.targetUserId) {
      io.to(`user_${payload.targetUserId}`).emit('attendance_updated', event);
    }
    return true;
  }

  function broadcastRehearsalCreated(payload) {
    if (!payload || !payload.rehearsal) return false;
    const event = {
      type: 'rehearsal_created',
      rehearsal: payload.rehearsal,
      targetUserIds: Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [],
      timestamp: formatTimestamp(Date.now()),
    };

    if (event.targetUserIds.length) {
      event.targetUserIds.forEach((userId) => {
        io.to(`user_${userId}`).emit('rehearsal_created', event);
      });
    } else {
      io.emit('rehearsal_created', event);
    }
    return true;
  }

  function broadcastRehearsalUpdated(payload) {
    if (!payload || !payload.rehearsalId) return false;
    const event = {
      type: 'rehearsal_updated',
      rehearsalId: payload.rehearsalId,
      changes: payload.changes || {},
      targetUserIds: Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [],
      timestamp: formatTimestamp(Date.now()),
    };

    io.to(`rehearsal_${payload.rehearsalId}`).emit('rehearsal_updated', event);
    event.targetUserIds.forEach((userId) => {
      io.to(`user_${userId}`).emit('rehearsal_updated', event);
    });
    return true;
  }

  function sendNotification(payload) {
    if (!payload || !payload.targetUserId || !payload.notification) return false;
    const event = {
      type: 'notification_created',
      notification: payload.notification,
      targetUserId: payload.targetUserId,
      timestamp: formatTimestamp(Date.now()),
    };

    io.to(`user_${payload.targetUserId}`).emit('notification_created', event);
    return true;
  }

  function broadcastInventoryEvent(data) {
    if (!data || typeof data !== 'object') return false;

    io.to('global').emit('inventory_event', {
      type: 'inventory_event',
      payload: data,
      timestamp: formatTimestamp(Date.now()),
    });

    return true;
  }

  function broadcastTicketScanEvent(data) {
    if (!data || typeof data !== 'object') return false;

    const event = {
      type: 'ticket_scan_event',
      payload: data,
      timestamp: formatTimestamp(Date.now()),
    };

    io.to('global').emit('ticket_scan_event', event);

    if (typeof data.showId === 'string' && data.showId.trim()) {
      io.to(`show_${data.showId}`).emit('ticket_scan_event', event);
    }

    return true;
  }

  function handleServerEvent(eventType, data) {
    switch (eventType) {
      case 'attendance_updated':
        return broadcastAttendanceUpdate(data);
      case 'rehearsal_created':
        return broadcastRehearsalCreated(data);
      case 'rehearsal_updated':
        return broadcastRehearsalUpdated(data);
      case 'notification_created':
        return sendNotification(data);
      case 'inventory_event':
        return broadcastInventoryEvent(data);
      case 'ticket_scan_event':
        return broadcastTicketScanEvent(data);
      default:
        return false;
    }
  }

  function isValidRoomIdentifier(room, prefixLength) {
    if (typeof room !== 'string') return false;
    if (room.length > 200) return false;
    if (prefixLength >= room.length) return false;
    const identifier = room.slice(prefixLength);
    return /^[A-Za-z0-9_-]+$/.test(identifier);
  }

  function isAllowedRoom(room, socket) {
    if (typeof room !== 'string' || !room) return false;
    if (room === 'global') return true;
    if (room.startsWith('user_')) {
      const expectedRoom = `user_${socket.data.userId}`;
      return expectedRoom === room;
    }
    if (room.startsWith('rehearsal_')) {
      return isValidRoomIdentifier(room, 'rehearsal_'.length);
    }
    if (room.startsWith('show_')) {
      return isValidRoomIdentifier(room, 'show_'.length);
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
    broadcastAttendanceUpdate,
    broadcastRehearsalCreated,
    broadcastRehearsalUpdated,
    sendNotification,
    broadcastInventoryEvent,
    broadcastTicketScanEvent,
    handleServerEvent,
    validateRoom,
  };
}
