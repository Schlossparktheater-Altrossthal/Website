import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import { resolveHandshakeSecret, verifyHandshakeToken } from "./handshake";
import { prisma } from "@/lib/prisma";
import { trackPresenceEvent } from "@/lib/realtime/presence";
import {
  ClientToServerEvents,
  InterServerEvents,
  NotificationCreatedEvent,
  OnlineStatsSnapshot,
  RealtimeEvent,
  RehearsalUpdatedEvent,
  RoomType,
  ServerToClientEvents,
  SocketData,
  UserPresenceEvent,
  UserJoinedEvent,
  UserLeftEvent,
} from "./types";

type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type EventTypeMap = {
  [K in RealtimeEvent['type']]: Extract<RealtimeEvent, { type: K }>;
};

interface ConnectedUser {
  sockets: Set<string>;
  name?: string;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;
  private connectedUsers = new Map<string, ConnectedUser>();
  private onlineStatsSubscribers = new Set<string>();

  private constructor() {}

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  public initialize(server: HTTPServer): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
      cors: {
        origin: process.env.NODE_ENV === "production" ? false : "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    this.setupEventHandlers();
    return this.io;
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.use((socket, next) => {
      this.authenticateSocket(socket as IOSocket, next);
    });

    this.io.on("connection", (socket) => {
      const client = socket as IOSocket;
      console.log(`[Realtime] socket connected: ${client.id}`);

      client.data.rooms = new Set<RoomType>();

      if (client.data.handshakeVerified && client.data.userId) {
        const userId = client.data.userId;
        const userName = client.data.userName;
        const userRoom: RoomType = `user_${userId}`;
        client.join(userRoom);
        client.data.rooms.add(userRoom);

        const isFirstConnection = this.addUserConnection(userId, client.id, userName);
        if (isFirstConnection) {
          this.notifyUserJoined(userId, userName);
        }

        this.emitOnlineStatsUpdate();
      } else {
        console.warn(`[Realtime] socket ${client.id} connected without verified handshake.`);
      }

      client.join("global");
      client.data.rooms.add("global");

      this.registerCoreListeners(client);
    });
  }

  private authenticateSocket(socket: IOSocket, next: (err?: Error) => void): void {
    const auth = socket.handshake?.auth ?? {};
    const token = typeof auth.token === "string" ? auth.token : undefined;
    const userId = typeof auth.userId === "string" ? auth.userId : undefined;
    const userName = typeof auth.userName === "string" ? auth.userName : undefined;

    if (!userId) {
      const address = socket.handshake?.address ?? "unknown";
      console.warn(
        `[Realtime] rejected socket ${socket.id} from ${address} - userId: ${userId ?? "unknown"} - reason: missing_user_id`,
      );
      next(new Error("Unauthorized"));
      return;
    }

    const secret = resolveHandshakeSecret();
    const verification = verifyHandshakeToken({ token, userId, secret });

    if (!verification.valid) {
      const address = socket.handshake?.address ?? "unknown";
      console.warn(
        `[Realtime] rejected socket ${socket.id} from ${address} - userId: ${userId} - reason: ${verification.reason}`,
      );
      next(new Error("Unauthorized"));
      return;
    }

    socket.data.handshakeVerified = true;
    socket.data.userId = userId;
    if (userName) {
      socket.data.userName = userName;
    }
    socket.data.handshake = {
      issuedAt: verification.issuedAt,
      expiresAt: verification.expiresAt,
    };

    next();
  }

  private registerCoreListeners(socket: IOSocket): void {
    socket.on("join_room", async (room: RoomType) => {
      try {
        if (!room) {
          this.logUnauthorizedRoomJoin(socket, room, "invalid room identifier");
          return;
        }

        if (!socket.data.rooms) {
          socket.data.rooms = new Set<RoomType>();
        }

        if (socket.data.rooms.has(room)) {
          return;
        }

        const allowed = await this.ensureRoomAccess(socket, room);
        if (!allowed) {
          return;
        }

        await socket.join(room);
        socket.data.rooms.add(room);

        if (room.startsWith("user_") && socket.data.userId) {
          const becameOnline = this.addUserConnection(socket.data.userId, socket.id, socket.data.userName);
          if (becameOnline) {
            this.notifyUserJoined(socket.data.userId, socket.data.userName);
            this.emitOnlineStatsUpdate();
          }
        }

        this.emitRehearsalPresence(socket, room, "join");
        console.log(`[Realtime] ${socket.id} joined room ${room}`);
      } catch (error) {
        console.error(`[Realtime] Failed to handle join_room for socket ${socket.id}`, error);
      }
    });

    socket.on("leave_room", (room: RoomType) => {
      socket.leave(room);
      socket.data.rooms.delete(room);

      this.emitRehearsalPresence(socket, room, "leave");
    });

    socket.on("ping", () => {
      socket.emit("pong");
    });

    socket.on("get_online_stats", () => {
      this.onlineStatsSubscribers.add(socket.id);
      this.emitOnlineStatsUpdate(socket);
    });

    socket.on("unsubscribe_online_stats", () => {
      this.onlineStatsSubscribers.delete(socket.id);
    });

    socket.on("get_rehearsal_users", (rehearsalId: string) => {
      this.respondWithRehearsalUsers(socket, rehearsalId);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Realtime] socket disconnected: ${socket.id}, reason: ${reason}`);

      this.onlineStatsSubscribers.delete(socket.id);

      if (socket.data.rooms) {
        socket.data.rooms.forEach((room) => {
          this.emitRehearsalPresence(socket, room, "leave");
        });
      }

      if (socket.data.userId) {
        const becameOffline = this.removeUserConnection(socket.data.userId, socket.id);
        if (becameOffline) {
          this.notifyUserLeft(socket.data.userId, socket.data.userName);
          this.emitOnlineStatsUpdate();
        }
      }
    });
  }

  private logUnauthorizedRoomJoin(socket: IOSocket, room: RoomType, reason: string): void {
    const userDescriptor = socket.data.userId ? `user ${socket.data.userId}` : "unauthenticated user";
    console.warn(
      `[Realtime] Blocked socket ${socket.id} (${userDescriptor}) from joining room ${room}: ${reason}`,
    );
  }

  private async ensureRoomAccess(socket: IOSocket, room: RoomType): Promise<boolean> {
    if (room === "global") {
      return true;
    }

    if (room.startsWith("user_")) {
      const authenticatedUserId = socket.data.userId;
      if (!authenticatedUserId) {
        this.logUnauthorizedRoomJoin(socket, room, "missing authenticated user");
        return false;
      }

      const targetUserId = room.substring("user_".length);
      if (!targetUserId || targetUserId !== authenticatedUserId) {
        this.logUnauthorizedRoomJoin(
          socket,
          room,
          `mismatched user room (expected user_${authenticatedUserId})`,
        );
        return false;
      }

      return true;
    }

    const userId = socket.data.userId;
    if (!userId) {
      this.logUnauthorizedRoomJoin(socket, room, "missing authenticated user");
      return false;
    }

    if (room.startsWith("rehearsal_")) {
      const rehearsalId = room.substring("rehearsal_".length);
      if (!rehearsalId) {
        this.logUnauthorizedRoomJoin(socket, room, "missing rehearsal identifier");
        return false;
      }

      const allowed = await this.isUserAuthorizedForRehearsal(userId, rehearsalId);
      if (!allowed) {
        this.logUnauthorizedRoomJoin(socket, room, `user ${userId} is not allowed to join rehearsal ${rehearsalId}`);
      }
      return allowed;
    }

    if (room.startsWith("show_")) {
      const showId = room.substring("show_".length);
      if (!showId) {
        this.logUnauthorizedRoomJoin(socket, room, "missing show identifier");
        return false;
      }

      const allowed = await this.isUserAuthorizedForShow(userId, showId);
      if (!allowed) {
        this.logUnauthorizedRoomJoin(socket, room, `user ${userId} is not allowed to join show ${showId}`);
      }
      return allowed;
    }

    return true;
  }

  private async isUserAuthorizedForRehearsal(userId: string, rehearsalId: string): Promise<boolean> {
    try {
      const rehearsal = await prisma.rehearsal.findFirst({
        where: {
          id: rehearsalId,
          OR: [
            { attendance: { some: { userId } } },
            { invitees: { some: { userId } } },
            { createdBy: userId },
          ],
        },
        select: { id: true },
      });

      return Boolean(rehearsal);
    } catch (error) {
      console.error(
        `[Realtime] Failed to verify rehearsal access for user ${userId} and rehearsal ${rehearsalId}`,
        error,
      );
      return false;
    }
  }

  private async isUserAuthorizedForShow(userId: string, showId: string): Promise<boolean> {
    try {
      const show = await prisma.show.findFirst({
        where: {
          id: showId,
          OR: [
            { characters: { some: { castings: { some: { userId } } } } },
            { rehearsals: { some: { attendance: { some: { userId } } } } },
            { rehearsals: { some: { invitees: { some: { userId } } } } },
          ],
        },
        select: { id: true },
      });

      return Boolean(show);
    } catch (error) {
      console.error(`[Realtime] Failed to verify show access for user ${userId} and show ${showId}`, error);
      return false;
    }
  }

  private emitRehearsalPresence(socket: IOSocket, room: RoomType, action: "join" | "leave"): void {
    if (!room.startsWith("rehearsal_") || !socket.data.userId || !socket.data.userName) {
      return;
    }

    const occurredAt = new Date();

    const presenceEvent: UserPresenceEvent = {
      type: "user_presence",
      action,
      room,
      user: {
        id: socket.data.userId,
        name: socket.data.userName,
      },
      timestamp: occurredAt.toISOString(),
    };

    void trackPresenceEvent({
      userId: socket.data.userId,
      room,
      action,
      occurredAt,
    });

    socket.to(room).emit("user_presence", presenceEvent);
  }

  private respondWithRehearsalUsers(socket: IOSocket, rehearsalId: string): void {
    if (!this.io) return;

    const roomName: RoomType = `rehearsal_${rehearsalId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);

    const users = room
      ? Array.from(room).flatMap((socketId) => {
          const participant = this.io!.sockets.sockets.get(socketId) as IOSocket | undefined;
          if (!participant?.data.userId) {
            return [];
          }
          return [
            {
              id: participant.data.userId,
              name: participant.data.userName,
            },
          ];
        })
      : [];

    socket.emit("rehearsal_users_list", {
      type: "rehearsal_users_list",
      rehearsalId,
      users,
      timestamp: new Date().toISOString(),
    });
  }

  private addUserConnection(userId: string, socketId: string, userName?: string): boolean {
    const existing = this.connectedUsers.get(userId);
    if (!existing) {
      this.connectedUsers.set(userId, {
        sockets: new Set([socketId]),
        name: userName,
      });
      return true;
    }

    existing.sockets.add(socketId);
    if (userName) {
      existing.name = userName;
    }
    return false;
  }

  private removeUserConnection(userId: string, socketId: string): boolean {
    const entry = this.connectedUsers.get(userId);
    if (!entry) {
      return false;
    }

    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) {
      this.connectedUsers.delete(userId);
      return true;
    }

    return false;
  }

  private notifyUserJoined(userId: string, userName?: string): void {
    const event: UserJoinedEvent = {
      type: "user_joined",
      timestamp: new Date().toISOString(),
      user: {
        id: userId,
        name: userName,
      },
    };

    this.emitToOnlineStatsSubscribers("user_joined", event);
  }

  private notifyUserLeft(userId: string, userName?: string): void {
    const event: UserLeftEvent = {
      type: "user_left",
      timestamp: new Date().toISOString(),
      user: {
        id: userId,
        name: userName,
      },
    };

    this.emitToOnlineStatsSubscribers("user_left", event);
  }

  private emitOnlineStatsUpdate(targetSocket?: IOSocket): void {
    const payload = {
      type: "online_stats_update" as const,
      timestamp: new Date().toISOString(),
      stats: this.getOnlineStatsSnapshot(),
    };

    if (targetSocket) {
      targetSocket.emit("online_stats_update", payload);
      return;
    }

    this.emitToOnlineStatsSubscribers("online_stats_update", payload);
  }

  public broadcastRehearsalUpdated(event: Omit<RehearsalUpdatedEvent, "timestamp">): void {
    const io = this.io;
    if (!io) return;

    const fullEvent: RehearsalUpdatedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    io.to(`rehearsal_${event.rehearsalId}`).emit("rehearsal_updated", fullEvent);
    event.targetUserIds.forEach((userId) => {
      io.to(`user_${userId}`).emit("rehearsal_updated", fullEvent);
    });

    console.log(`[Realtime] broadcast rehearsal updated ${event.rehearsalId}`);
  }

  public sendNotification(event: Omit<NotificationCreatedEvent, "timestamp">): void {
    const io = this.io;
    if (!io) return;

    const fullEvent: NotificationCreatedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    io.to(`user_${event.targetUserId}`).emit("notification_created", fullEvent);

    console.log(`[Realtime] sent notification to user ${event.targetUserId}`);
  }

  private getOnlineStatsSnapshot(): OnlineStatsSnapshot {
    return {
      totalOnline: this.connectedUsers.size,
      onlineUsers: Array.from(this.connectedUsers.entries()).map(([id, info]) => ({
        id,
        name: info.name,
      })),
    };
  }

  private emitToOnlineStatsSubscribers<E extends keyof ServerToClientEvents>(
    event: E,
    ...payload: Parameters<ServerToClientEvents[E]>
  ): void {
    if (!this.io) return;

    this.onlineStatsSubscribers.forEach((socketId) => {
      const subscriber = this.io!.sockets.sockets.get(socketId) as IOSocket | undefined;
      if (subscriber) {
        subscriber.emit(event, ...payload);
      } else {
        this.onlineStatsSubscribers.delete(socketId);
      }
    });
  }

  public broadcast<T extends RealtimeEvent>(event: T, rooms: RoomType[] | RoomType, excludeSocket?: string): void {
    const io = this.io;
    if (!io) return;

    const roomArray = Array.isArray(rooms) ? rooms : [rooms];
    const eventName = event.type as keyof EventTypeMap & keyof ServerToClientEvents;
    const payload = event as EventTypeMap[typeof eventName];
    const args = [payload] as Parameters<ServerToClientEvents[typeof eventName]>;

    roomArray.forEach((room) => {
      const emitter = excludeSocket ? io.to(room).except(excludeSocket) : io.to(room);
      emitter.emit(eventName, ...args);
    });
  }

  public getRoomInfo(): Record<string, number> {
    const io = this.io;
    if (!io) return {};

    const rooms: Record<string, number> = {};
    io.sockets.adapter.rooms.forEach((sockets, room) => {
      if (!io.sockets.sockets.has(room)) {
        rooms[room] = sockets.size;
      }
    });
    return rooms;
  }
}

export const realtimeService = RealtimeService.getInstance();
