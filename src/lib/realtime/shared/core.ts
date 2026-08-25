import type { AttendanceStatus } from "@prisma/client";
import type { Server as SocketIOServer, Socket } from "socket.io";

import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";
import type {
  AttendanceUpdatedEvent,
  ClientToServerEvents,
  InterServerEvents,
  InventoryRealtimeEvent,
  InventoryRealtimePayload,
  NotificationCreatedEvent,
  OnboardingDashboardUpdateEvent,
  OnlineStatsSnapshot,
  OnlineStatsUpdateEvent,
  RealtimeEvent,
  RehearsalCreatedEvent,
  RehearsalUpdatedEvent,
  RehearsalUsersListEvent,
  RoomType,
  ServerToClientEvents,
  SocketData,
  TicketRealtimePayload,
  TicketScanRealtimeEvent,
  UserJoinedEvent,
  UserLeftEvent,
  UserPresenceEvent,
} from "../types";

export interface PresenceTrackingInput {
  userId: string;
  room: RoomType;
  action: "join" | "leave";
  occurredAt: Date;
}

export interface RealtimeCoreOptions {
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  logger?: Pick<Console, "error" | "warn" | "log">;
  toISO?: (value: Date) => string;
  trackPresenceEvent?: (payload: PresenceTrackingInput) => void | Promise<void>;
}

export interface TrackConnectionResult {
  isFirstConnection: boolean;
  userName?: string;
}

export interface ReleaseConnectionResult {
  isLastConnection: boolean;
  userName?: string;
}

type SocketIOServerInstance = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type SocketInstance = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type EmitTargets = "all" | "subscribers" | Iterable<string>;

export interface RealtimeCore {
  readonly io: SocketIOServerInstance;
  readonly connectedUsers: Map<string, { sockets: Set<string>; name?: string; lastSeen?: number }>;
  readonly peakConcurrentUsers: number;
  trackConnection(details: {
    userId: string;
    socketId: string;
    userName?: string;
    lastSeen?: number | Date;
  }): TrackConnectionResult;
  releaseConnection(details: { userId: string; socketId: string }): ReleaseConnectionResult;
  addOnlineStatsSubscriber(socketId: string): void;
  removeOnlineStatsSubscriber(socketId: string): void;
  emitOnlineStatsUpdate(options?: { targetSocket?: SocketInstance; broadcast?: boolean }): void;
  emitUserJoined(details: { userId: string; userName?: string; targets?: EmitTargets }): void;
  emitUserLeft(details: { userId: string; userName?: string; targets?: EmitTargets }): void;
  emitRehearsalPresence(details: {
    room: RoomType;
    socket: SocketInstance;
    action: "join" | "leave";
  }): void;
  emitRehearsalUsersList(details: { rehearsalId: string; socket: SocketInstance }): Promise<void>;
  broadcast(event: RealtimeEvent, rooms: RoomType | RoomType[], excludeSocketId?: string): boolean;
  broadcastAttendanceUpdate(payload: {
    rehearsalId: string;
    targetUserId?: string | null;
    status?: string | null;
    comment?: string | null;
    actorUserId?: string | null;
  }): boolean;
  broadcastRehearsalCreated(payload: {
    rehearsal: RehearsalCreatedEvent["rehearsal"];
    targetUserIds?: string[];
  }): boolean;
  broadcastRehearsalUpdated(
    payload: Omit<RehearsalUpdatedEvent, "timestamp">,
    options?: { timestamp?: Date | number },
  ): boolean;
  sendNotification(
    payload: Omit<NotificationCreatedEvent, "timestamp">,
    options?: { timestamp?: Date | number },
  ): boolean;
  broadcastInventoryEvent(
    payload: InventoryRealtimePayload,
    options?: {
      rooms?: RoomType | RoomType[];
      excludeSocketId?: string;
      timestamp?: Date | number;
    },
  ): boolean;
  broadcastTicketScanEvent(
    payload: TicketRealtimePayload,
    options?: {
      rooms?: RoomType | RoomType[];
      excludeSocketId?: string;
      timestamp?: Date | number;
    },
  ): boolean;
  broadcastOnboardingDashboardUpdate(
    payload: {
      onboardingId: string;
      dashboard: unknown;
      broadcastToGlobal?: boolean;
    },
    options?: { timestamp?: Date | number },
  ): boolean;
  handleServerEvent(eventType: string, data: unknown): boolean;
  getOnlineStatsSnapshot(): OnlineStatsSnapshot & { peakConcurrentUsers?: number };
  emitToTargets(eventName: string, payload: unknown, targets?: EmitTargets): void;
  clearSocket(socketId: string): void;
  formatTimestamp(value?: number | Date): string;
}

type BroadcastOperator = ReturnType<SocketIOServerInstance["to"]>;

type DynamicBroadcastOperator = BroadcastOperator & {
  emit(event: string, payload: unknown): unknown;
};

type DynamicEmitter = SocketIOServerInstance & {
  emit(event: string, payload: unknown): boolean;
};

type DynamicSocket = SocketInstance & {
  emit(event: string, payload: unknown): unknown;
};

type PresenceParticipant = {
  data?: { userId?: string; userName?: string };
};

function defaultToISO(value: Date | number): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function normalizeDateInput(value: Date | number | undefined): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  return new Date();
}

function createEmitter(
  io: DynamicEmitter,
  room: string,
  excludeSocketId?: string,
): DynamicBroadcastOperator {
  const baseEmitter = io.to(room) as DynamicBroadcastOperator;
  if (!excludeSocketId || typeof baseEmitter?.except !== "function") {
    return baseEmitter;
  }
  return baseEmitter.except(excludeSocketId) as DynamicBroadcastOperator;
}

export function createRealtimeCore(
  options: RealtimeCoreOptions = {} as RealtimeCoreOptions,
): RealtimeCore {
  const { io, logger = console, toISO = defaultToISO, trackPresenceEvent } = options;

  if (!io) {
    throw new Error("Socket server instance is required");
  }

  const dynamicIo = io as DynamicEmitter;

  const logError =
    typeof logger?.error === "function"
      ? (...args: unknown[]): void => logger.error(...args)
      : (...args: unknown[]): void => console.error(...args);
  const logWarn =
    typeof logger?.warn === "function"
      ? (...args: unknown[]): void => logger.warn(...args)
      : (...args: unknown[]): void => console.warn(...args);

  const formatTimestamp = (value?: number | Date): string => {
    const date = normalizeDateInput(value ?? Date.now());
    try {
      return toISO(date);
    } catch (error) {
      logWarn("[Realtime] Failed to format timestamp via custom formatter", error);
      return date.toISOString();
    }
  };

  const connectedUsers = new Map<
    string,
    { sockets: Set<string>; name?: string; lastSeen?: number }
  >();
  const onlineStatsSubscribers = new Set<string>();
  let peakConcurrentUsers = 0;

  function trackConnection(details: {
    userId: string;
    socketId: string;
    userName?: string;
    lastSeen?: number | Date;
  }): TrackConnectionResult {
    const { userId, socketId, userName, lastSeen } = details;
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

  function releaseConnection(details: {
    userId: string;
    socketId: string;
  }): ReleaseConnectionResult {
    const { userId, socketId } = details;
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

  function addOnlineStatsSubscriber(socketId: string): void {
    if (!socketId) return;
    onlineStatsSubscribers.add(socketId);
  }

  function removeOnlineStatsSubscriber(socketId: string): void {
    if (!socketId) return;
    onlineStatsSubscribers.delete(socketId);
  }

  function emitToTargets(
    eventName: string,
    payload: unknown,
    targets: EmitTargets = "subscribers",
  ): void {
    if (targets === "all") {
      dynamicIo.emit(eventName, payload);
      return;
    }

    const ids =
      !targets || targets === "subscribers"
        ? Array.from(onlineStatsSubscribers)
        : Array.from(targets).filter((id): id is string => typeof id === "string");

    ids.forEach((socketId) => {
      const recipient = io.sockets.sockets.get(socketId) as DynamicSocket | undefined;
      if (recipient) {
        recipient.emit(eventName, payload);
      } else if (!targets || targets === "subscribers") {
        onlineStatsSubscribers.delete(socketId);
      }
    });
  }

  function emitOnlineStatsUpdate(
    options: {
      targetSocket?: SocketInstance;
      broadcast?: boolean;
    } = {},
  ): void {
    const { targetSocket, broadcast = false } = options;
    const event: OnlineStatsUpdateEvent = {
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

  function emitUserJoined(details: {
    userId: string;
    userName?: string;
    targets?: EmitTargets;
  }): void {
    const { userId, userName, targets } = details;
    if (!userId) return;
    const event: UserJoinedEvent = {
      type: "user_joined",
      timestamp: formatTimestamp(),
      user: { id: userId, name: userName },
    };
    emitToTargets("user_joined", event, targets ?? "subscribers");
  }

  function emitUserLeft(details: {
    userId: string;
    userName?: string;
    targets?: EmitTargets;
  }): void {
    const { userId, userName, targets } = details;
    if (!userId) return;
    const event: UserLeftEvent = {
      type: "user_left",
      timestamp: formatTimestamp(),
      user: { id: userId, name: userName },
    };
    emitToTargets("user_left", event, targets ?? "subscribers");
  }

  function emitRehearsalPresence(details: {
    room: RoomType;
    socket: SocketInstance;
    action: "join" | "leave";
  }): void {
    const { room, socket, action } = details;
    if (!room || typeof room !== "string") return;
    if (!room.startsWith("rehearsal_")) return;

    const userId = socket?.data?.userId;
    const userName = socket?.data?.userName;
    if (!userId || !userName) {
      return;
    }

    const occurredAt = new Date();
    const payload: UserPresenceEvent = {
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
        if (result instanceof Promise) {
          result.catch((error: unknown) =>
            logError("[Realtime] Failed to track presence event", error),
          );
        }
      } catch (error) {
        logError("[Realtime] Failed to track presence event", error);
      }
    }

    const emitter = socket?.to?.(room);
    emitter?.emit?.("user_presence", payload);
  }

  async function emitRehearsalUsersList(details: {
    rehearsalId: string;
    socket: SocketInstance;
  }): Promise<void> {
    const { rehearsalId, socket } = details;
    if (!rehearsalId || !socket) return;
    const roomName = `rehearsal_${rehearsalId}`;

    let participants: PresenceParticipant[];
    try {
      if (typeof io.in === "function" && typeof io.in(roomName).fetchSockets === "function") {
        participants = (await io.in(roomName).fetchSockets()) as PresenceParticipant[];
      } else {
        const room = io.sockets.adapter.rooms.get(roomName);
        participants = room
          ? Array.from(room)
              .map((socketId) => io.sockets.sockets.get(socketId))
              .filter((candidate): candidate is SocketInstance => Boolean(candidate))
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
    } satisfies RehearsalUsersListEvent);
  }

  function broadcast(
    event: RealtimeEvent,
    rooms: RoomType | RoomType[],
    excludeSocketId?: string,
  ): boolean {
    if (!event || !rooms) return false;
    const roomArray = Array.isArray(rooms) ? rooms : [rooms];
    roomArray
      .filter((room) => typeof room === "string" && Boolean(room))
      .forEach((room) => {
        const emitter = createEmitter(dynamicIo, room, excludeSocketId);
        emitter?.emit?.(event.type, event);
      });
    return true;
  }

  function broadcastAttendanceUpdate(payload: {
    rehearsalId: string;
    targetUserId?: string | null;
    status?: string | null;
    comment?: string | null;
    actorUserId?: string | null;
  }): boolean {
    if (!payload || !payload.rehearsalId) return false;
    const event: AttendanceUpdatedEvent = {
      type: "attendance_updated",
      rehearsalId: payload.rehearsalId,
      targetUserId: payload.targetUserId as string,
      status: (payload.status ?? null) as AttendanceStatus | null,
      comment: payload.comment as string | undefined,
      actorUserId: payload.actorUserId as string,
      timestamp: formatTimestamp(),
    };

    broadcast(event, `rehearsal_${payload.rehearsalId}`);
    if (payload.targetUserId) {
      broadcast(event, `user_${payload.targetUserId}`);
    }
    return true;
  }

  function broadcastRehearsalCreated(payload: {
    rehearsal: RehearsalCreatedEvent["rehearsal"];
    targetUserIds?: string[];
  }): boolean {
    if (!payload || !payload.rehearsal) return false;
    const event: RehearsalCreatedEvent = {
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

  function broadcastRehearsalUpdated(
    payload: Omit<RehearsalUpdatedEvent, "timestamp">,
    options: { timestamp?: Date | number } = {},
  ): boolean {
    if (!payload || !payload.rehearsalId) return false;
    const event: RehearsalUpdatedEvent = {
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

  function sendNotification(
    payload: Omit<NotificationCreatedEvent, "timestamp">,
    options: { timestamp?: Date | number } = {},
  ): boolean {
    if (!payload || !payload.targetUserId || !payload.notification) return false;
    const event: NotificationCreatedEvent = {
      type: "notification_created",
      notification: payload.notification,
      targetUserId: payload.targetUserId,
      timestamp: formatTimestamp(options.timestamp ?? Date.now()),
    };

    broadcast(event, `user_${payload.targetUserId}`);
    return true;
  }

  function broadcastInventoryEvent(
    payload: InventoryRealtimePayload,
    options: {
      rooms?: RoomType | RoomType[];
      excludeSocketId?: string;
      timestamp?: Date | number;
    } = {},
  ): boolean {
    if (!payload || typeof payload !== "object") return false;
    const event: InventoryRealtimeEvent = {
      type: "inventory_event",
      payload,
      timestamp: formatTimestamp(options.timestamp ?? Date.now()),
    };

    const rooms = options.rooms ?? ["global"];
    broadcast(event, rooms, options.excludeSocketId);
    return true;
  }

  function broadcastTicketScanEvent(
    payload: TicketRealtimePayload,
    options: {
      rooms?: RoomType | RoomType[];
      excludeSocketId?: string;
      timestamp?: Date | number;
    } = {},
  ): boolean {
    if (!payload || typeof payload !== "object") return false;
    const event: TicketScanRealtimeEvent = {
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

  function broadcastOnboardingDashboardUpdate(
    payload: {
      onboardingId: string;
      dashboard: unknown;
      broadcastToGlobal?: boolean;
    },
    options: { timestamp?: Date | number } = {},
  ): boolean {
    if (!payload || typeof payload !== "object") return false;
    const { onboardingId, dashboard } = payload;
    if (typeof onboardingId !== "string" || !onboardingId.trim()) return false;
    if (!dashboard || typeof dashboard !== "object") return false;

    const event: OnboardingDashboardUpdateEvent = {
      type: "onboarding_dashboard_update",
      onboardingId,
      dashboard: dashboard as OnboardingDashboardData,
      timestamp: formatTimestamp(options.timestamp ?? Date.now()),
    };

    broadcast(event, `onboarding_${onboardingId}`);
    if (payload.broadcastToGlobal) {
      broadcast(event, "global");
    }
    return true;
  }

  function handleServerEvent(eventType: string, data: unknown): boolean {
    switch (eventType) {
      case "attendance_updated":
        return broadcastAttendanceUpdate(
          data as {
            rehearsalId: string;
            targetUserId?: string | null;
            status?: string | null;
            comment?: string | null;
            actorUserId?: string | null;
          },
        );
      case "rehearsal_created":
        return broadcastRehearsalCreated(
          data as {
            rehearsal: RehearsalCreatedEvent["rehearsal"];
            targetUserIds?: string[];
          },
        );
      case "rehearsal_updated":
        return broadcastRehearsalUpdated(data as Omit<RehearsalUpdatedEvent, "timestamp">);
      case "notification_created":
        return sendNotification(data as Omit<NotificationCreatedEvent, "timestamp">);
      case "inventory_event":
        return broadcastInventoryEvent(data as InventoryRealtimePayload);
      case "ticket_scan_event":
        return broadcastTicketScanEvent(data as TicketRealtimePayload);
      case "onboarding_dashboard_update":
        return broadcastOnboardingDashboardUpdate(
          data as {
            onboardingId: string;
            dashboard: unknown;
            broadcastToGlobal?: boolean;
          },
        );
      default:
        return false;
    }
  }

  function getOnlineStatsSnapshot(): OnlineStatsSnapshot {
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

  function clearSocket(socketId: string): void {
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
