import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { 
  RealtimeEvent, 
  RoomType,
  AttendanceUpdatedEvent,
  RehearsalCreatedEvent,
  RehearsalUpdatedEvent,
  NotificationCreatedEvent,
  UserPresenceEvent,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from "./types";

export class RealtimeService {
  private static instance: RealtimeService;
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

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
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    return this.io;
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Initialize socket data
      socket.data.rooms = new Set();

      // Handle room joining
      socket.on('join_room', (room: RoomType) => {
        socket.join(room);
        socket.data.rooms.add(room);
        
        // Track user presence
        if (room.startsWith('user_')) {
          const userId = room.substring(5); // Remove 'user_' prefix
          socket.data.userId = userId;
          this.addUserConnection(userId, socket.id);
        }

        // Emit presence event for rehearsal rooms
        if (room.startsWith('rehearsal_') && socket.data.userId && socket.data.userName) {
          const presenceEvent: UserPresenceEvent = {
            type: 'user_presence',
            action: 'join',
            room,
            user: {
              id: socket.data.userId,
              name: socket.data.userName
            },
            timestamp: new Date().toISOString()
          };
          socket.to(room).emit('user_presence', presenceEvent);
        }

        console.log(`Socket ${socket.id} joined room: ${room}`);
      });

      // Handle room leaving
      socket.on('leave_room', (room: RoomType) => {
        socket.leave(room);
        socket.data.rooms.delete(room);
        
        // Emit presence event for rehearsal rooms
        if (room.startsWith('rehearsal_') && socket.data.userId && socket.data.userName) {
          const presenceEvent: UserPresenceEvent = {
            type: 'user_presence',
            action: 'leave',
            room,
            user: {
              id: socket.data.userId,
              name: socket.data.userName
            },
            timestamp: new Date().toISOString()
          };
          socket.to(room).emit('user_presence', presenceEvent);
        }
      });

      // Handle ping/pong for connection monitoring
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        
        if (socket.data.userId) {
          this.removeUserConnection(socket.data.userId, socket.id);
          
          // Emit leave presence for all rehearsal rooms
          socket.data.rooms.forEach(room => {
            if (room.startsWith('rehearsal_') && socket.data.userName) {
              const presenceEvent: UserPresenceEvent = {
                type: 'user_presence',
                action: 'leave',
                room,
                user: {
                  id: socket.data.userId!,
                  name: socket.data.userName
                },
                timestamp: new Date().toISOString()
              };
              socket.to(room).emit('user_presence', presenceEvent);
            }
          });
        }
      });
    });
  }

  // User connection tracking
  private addUserConnection(userId: string, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
  }

  private removeUserConnection(userId: string, socketId: string): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Event Broadcasting Methods
  public broadcastAttendanceUpdate(event: Omit<AttendanceUpdatedEvent, 'timestamp'>): void {
    if (!this.io) return;

    const fullEvent: AttendanceUpdatedEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    // Broadcast to rehearsal room and affected users
    this.io.to(`rehearsal_${event.rehearsalId}`).emit('attendance_updated', fullEvent);
    this.io.to(`user_${event.targetUserId}`).emit('attendance_updated', fullEvent);
    
    console.log(`Broadcasted attendance update: ${event.rehearsalId} - ${event.status}`);
  }

  public broadcastRehearsalCreated(event: Omit<RehearsalCreatedEvent, 'timestamp'>): void {
    if (!this.io) return;

    const fullEvent: RehearsalCreatedEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    // Send to specific users
    event.targetUserIds.forEach(userId => {
      this.io!.to(`user_${userId}`).emit('rehearsal_created', fullEvent);
    });

    console.log(`Broadcasted rehearsal created: ${event.rehearsal.id}`);
  }

  public broadcastRehearsalUpdated(event: Omit<RehearsalUpdatedEvent, 'timestamp'>): void {
    if (!this.io) return;

    const fullEvent: RehearsalUpdatedEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    // Broadcast to rehearsal room and affected users
    this.io.to(`rehearsal_${event.rehearsalId}`).emit('rehearsal_updated', fullEvent);
    event.targetUserIds.forEach(userId => {
      this.io!.to(`user_${userId}`).emit('rehearsal_updated', fullEvent);
    });

    console.log(`Broadcasted rehearsal updated: ${event.rehearsalId}`);
  }

  public sendNotification(event: Omit<NotificationCreatedEvent, 'timestamp'>): void {
    if (!this.io) return;

    const fullEvent: NotificationCreatedEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    this.io.to(`user_${event.targetUserId}`).emit('notification_created', fullEvent);
    
    console.log(`Sent notification to user: ${event.targetUserId}`);
  }

  // Generic broadcast method for extensibility
  public broadcast<T extends RealtimeEvent>(
    event: T, 
    rooms: RoomType[] | RoomType, 
    excludeSocket?: string
  ): void {
    if (!this.io) return;

    const roomArray = Array.isArray(rooms) ? rooms : [rooms];
    
    roomArray.forEach(room => {
      const emitter = excludeSocket 
        ? this.io!.to(room).except(excludeSocket)
        : this.io!.to(room);
      
      emitter.emit(event.type as keyof ServerToClientEvents, event as any);
    });
  }

  // Admin methods for monitoring
  public getRoomInfo(): Record<string, number> {
    if (!this.io) return {};

    const rooms: Record<string, number> = {};
    this.io.sockets.adapter.rooms.forEach((sockets, room) => {
      // Skip socket IDs (they are also in rooms map)
      if (!this.io!.sockets.sockets.has(room)) {
        rooms[room] = sockets.size;
      }
    });
    return rooms;
  }
}

// Singleton instance
export const realtimeService = RealtimeService.getInstance();