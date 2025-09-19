import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import {
  AttendanceUpdatedEvent,
  ClientToServerEvents,
  InterServerEvents,
  NotificationCreatedEvent,
  OnlineStatsSnapshot,
  RealtimeEvent,
  RehearsalCreatedEvent,
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

    this.io.on("connection", (socket) => {
      const client = socket as IOSocket;
      console.log(`[Realtime] socket connected: ${client.id}`);

      client.data.rooms = new Set<RoomType>();

      const { userId, userName } = this.extractUserFromHandshake(client);

      if (userId) {
        client.data.userId = userId;
        if (userName) {
          client.data.userName = userName;
        }

        const userRoom: RoomType = `user_${userId}`;
        client.join(userRoom);
        client.data.rooms.add(userRoom);

        const isFirstConnection = this.addUserConnection(userId, client.id, userName);
        if (isFirstConnection) {
          this.notifyUserJoined(userId, userName);
        }

        this.emitOnlineStatsUpdate();
      }

      client.join("global");
      client.data.rooms.add("global");

      this.registerCoreListeners(client);
    });
  }

  private extractUserFromHandshake(socket: IOSocket): { userId?: string; userName?: string } {
    const auth = socket.handshake?.auth ?? {};
    const userId = typeof auth.userId === "string" ? auth.userId : undefined;
    const userName = typeof auth.userName === "string" ? auth.userName : undefined;
    return { userId, userName };
  }

  private registerCoreListeners(socket: IOSocket): void {
    socket.on("join_room", (room: RoomType) => {
      socket.join(room);
      socket.data.rooms.add(room);

      if (room.startsWith("user_")) {
        const userId = room.substring(5);
        socket.data.userId = userId;
        const becameOnline = this.addUserConnection(userId, socket.id, socket.data.userName);
        if (becameOnline) {
          this.notifyUserJoined(userId, socket.data.userName);
          this.emitOnlineStatsUpdate();
        }
      }

      this.emitRehearsalPresence(socket, room, "join");
      console.log(`[Realtime] ${socket.id} joined room ${room}`);
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

  private emitRehearsalPresence(socket: IOSocket, room: RoomType, action: "join" | "leave"): void {
    if (!room.startsWith("rehearsal_") || !socket.data.userId || !socket.data.userName) {
      return;
    }

    const presenceEvent: UserPresenceEvent = {
      type: "user_presence",
      action,
      room,
      user: {
        id: socket.data.userId,
        name: socket.data.userName,
      },
      timestamp: new Date().toISOString(),
    };

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

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public broadcastAttendanceUpdate(event: Omit<AttendanceUpdatedEvent, "timestamp">): void {
    const io = this.io;
    if (!io) return;

    const fullEvent: AttendanceUpdatedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    io.to(`rehearsal_${event.rehearsalId}`).emit("attendance_updated", fullEvent);
    io.to(`user_${event.targetUserId}`).emit("attendance_updated", fullEvent);

    console.log(`[Realtime] broadcast attendance update for rehearsal ${event.rehearsalId}`);
  }

  public broadcastRehearsalCreated(event: Omit<RehearsalCreatedEvent, "timestamp">): void {
    const io = this.io;
    if (!io) return;

    const fullEvent: RehearsalCreatedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    event.targetUserIds.forEach((userId) => {
      io.to(`user_${userId}`).emit("rehearsal_created", fullEvent);
    });

    console.log(`[Realtime] broadcast rehearsal created ${event.rehearsal.id}`);
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
