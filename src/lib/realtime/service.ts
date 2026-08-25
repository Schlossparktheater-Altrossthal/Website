import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import { resolveHandshakeSecret, verifyHandshakeToken } from "./handshake";
import { prisma } from "@/lib/prisma";
import { trackPresenceEvent } from "@/lib/realtime/presence";
import { createRealtimeCore } from "@/lib/realtime/shared";
import {
  ClientToServerEvents,
  InterServerEvents,
  InventoryRealtimePayload,
  NotificationCreatedEvent,
  RealtimeEvent,
  RehearsalUpdatedEvent,
  RoomType,
  ServerToClientEvents,
  SocketData,
  TicketRealtimePayload,
} from "./types";

type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

type RealtimeCore = ReturnType<typeof createRealtimeCore>;

export class RealtimeService {
  private static instance: RealtimeService;
  private io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > | null = null;
  private core: RealtimeCore | null = null;

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

    this.io = new SocketIOServer<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >(server, {
      cors: {
        origin: process.env.NODE_ENV === "production" ? false : "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    this.core = createRealtimeCore({
      io: this.io,
      logger: console,
      trackPresenceEvent: ({ userId, room, action, occurredAt }) =>
        trackPresenceEvent({ userId, room, action, occurredAt }),
    });

    this.setupEventHandlers();
    return this.io;
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  private setupEventHandlers(): void {
    const io = this.io;
    const core = this.core;

    if (!io || !core) return;

    io.use((socket, next) => {
      this.authenticateSocket(socket as IOSocket, next);
    });

    io.on("connection", (socket) => {
      const client = socket as IOSocket;
      console.log(`[Realtime] socket connected: ${client.id}`);

      client.data.rooms = new Set<RoomType>();

      if (client.data.handshakeVerified && client.data.userId) {
        const { isFirstConnection, userName } = core.trackConnection({
          userId: client.data.userId,
          socketId: client.id,
          userName: client.data.userName,
        });
        const userRoom: RoomType = `user_${client.data.userId}`;
        client.join(userRoom);
        client.data.rooms.add(userRoom);
        if (isFirstConnection) {
          core.emitUserJoined({
            userId: client.data.userId,
            userName: userName ?? client.data.userName,
          });
        }
        core.emitOnlineStatsUpdate();
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
    if (!this.core) return;
    const core = this.core;

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
          const { isFirstConnection } = core.trackConnection({
            userId: socket.data.userId,
            socketId: socket.id,
            userName: socket.data.userName,
          });
          if (isFirstConnection) {
            core.emitUserJoined({ userId: socket.data.userId, userName: socket.data.userName });
            core.emitOnlineStatsUpdate();
          }
        }

        core.emitRehearsalPresence({ socket, room, action: "join" });
        console.log(`[Realtime] ${socket.id} joined room ${room}`);
      } catch (error) {
        console.error(`[Realtime] Failed to handle join_room for socket ${socket.id}`, error);
      }
    });

    socket.on("leave_room", (room: RoomType) => {
      socket.leave(room);
      socket.data.rooms.delete(room);

      core.emitRehearsalPresence({ socket, room, action: "leave" });
    });

    socket.on("ping", () => {
      socket.emit("pong");
    });

    socket.on("get_online_stats", () => {
      core.addOnlineStatsSubscriber(socket.id);
      core.emitOnlineStatsUpdate({ targetSocket: socket });
    });

    socket.on("unsubscribe_online_stats", () => {
      core.removeOnlineStatsSubscriber(socket.id);
    });

    socket.on("get_rehearsal_users", (rehearsalId: string) => {
      core.emitRehearsalUsersList({ rehearsalId, socket });
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Realtime] socket disconnected: ${socket.id}, reason: ${reason}`);

      core.removeOnlineStatsSubscriber(socket.id);

      if (socket.data.rooms) {
        socket.data.rooms.forEach((room) => {
          core.emitRehearsalPresence({ socket, room, action: "leave" });
        });
      }

      if (socket.data.userId) {
        const { isLastConnection, userName } = core.releaseConnection({
          userId: socket.data.userId,
          socketId: socket.id,
        });
        if (isLastConnection) {
          core.emitUserLeft({
            userId: socket.data.userId,
            userName: userName ?? socket.data.userName,
          });
          core.emitOnlineStatsUpdate();
        }
      }

      core.clearSocket(socket.id);
    });
  }

  private logUnauthorizedRoomJoin(socket: IOSocket, room: RoomType, reason: string): void {
    const userDescriptor = socket.data.userId
      ? `user ${socket.data.userId}`
      : "unauthenticated user";
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
        this.logUnauthorizedRoomJoin(
          socket,
          room,
          `user ${userId} is not allowed to join rehearsal ${rehearsalId}`,
        );
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
        this.logUnauthorizedRoomJoin(
          socket,
          room,
          `user ${userId} is not allowed to join show ${showId}`,
        );
      }
      return allowed;
    }

    return true;
  }

  private async isUserAuthorizedForRehearsal(
    userId: string,
    rehearsalId: string,
  ): Promise<boolean> {
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
      const membership = await prisma.productionMembership.findFirst({
        where: {
          userId,
          showId,
          OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
        },
        select: { id: true },
      });

      return Boolean(membership);
    } catch (error) {
      console.error(
        `[Realtime] Failed to verify show access for user ${userId} and show ${showId}`,
        error,
      );
      return false;
    }
  }

  public broadcastRehearsalUpdated(event: Omit<RehearsalUpdatedEvent, "timestamp">): void {
    if (!this.core) return;
    this.core.broadcastRehearsalUpdated(event);
    console.log(`[Realtime] broadcast rehearsal updated ${event.rehearsalId}`);
  }

  public sendNotification(event: Omit<NotificationCreatedEvent, "timestamp">): void {
    if (!this.core) return;
    this.core.sendNotification(event);
    console.log(`[Realtime] sent notification to user ${event.targetUserId}`);
  }

  public broadcastInventoryEvent(payload: InventoryRealtimePayload): void {
    if (!this.core) return;
    this.core.broadcastInventoryEvent(payload);
  }

  public broadcastTicketScanEvent(payload: TicketRealtimePayload): void {
    if (!this.core) return;
    this.core.broadcastTicketScanEvent(payload);
  }

  public broadcast<T extends RealtimeEvent>(
    event: T,
    rooms: RoomType[] | RoomType,
    excludeSocket?: string,
  ): void {
    this.core?.broadcast(event, rooms, excludeSocket);
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
