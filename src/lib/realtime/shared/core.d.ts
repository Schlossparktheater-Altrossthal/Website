import type {
  ClientToServerEvents,
  InterServerEvents,
  NotificationCreatedEvent,
  OnlineStatsSnapshot,
  RealtimeEvent,
  RehearsalCreatedEvent,
  RehearsalUpdatedEvent,
  RoomType,
  SocketData,
  TicketRealtimePayload,
  InventoryRealtimePayload,
  ServerToClientEvents,
} from '../types';
import type { Server as SocketIOServer, Socket } from 'socket.io';

export interface PresenceTrackingInput {
  userId: string;
  room: RoomType;
  action: 'join' | 'leave';
  occurredAt: Date;
}

export interface RealtimeCoreOptions {
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  logger?: Pick<Console, 'error' | 'warn' | 'log'>;
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

type SocketIOServerInstance = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type SocketInstance = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

type EmitTargets = 'all' | 'subscribers' | Iterable<string>;

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
  emitRehearsalPresence(details: { room: RoomType; socket: SocketInstance; action: 'join' | 'leave' }): void;
  emitRehearsalUsersList(details: { rehearsalId: string; socket: SocketInstance }): void;
  broadcast(event: RealtimeEvent, rooms: RoomType | RoomType[], excludeSocketId?: string): boolean;
  broadcastAttendanceUpdate(payload: {
    rehearsalId: string;
    targetUserId?: string | null;
    status?: string | null;
    comment?: string | null;
    actorUserId?: string | null;
  }): boolean;
  broadcastRehearsalCreated(payload: {
    rehearsal: RehearsalCreatedEvent['rehearsal'];
    targetUserIds?: string[];
  }): boolean;
  broadcastRehearsalUpdated(
    payload: Omit<RehearsalUpdatedEvent, 'timestamp'>,
    options?: { timestamp?: Date | number },
  ): boolean;
  sendNotification(
    payload: Omit<NotificationCreatedEvent, 'timestamp'>,
    options?: { timestamp?: Date | number },
  ): boolean;
  broadcastInventoryEvent(
    payload: InventoryRealtimePayload,
    options?: { rooms?: RoomType | RoomType[]; excludeSocketId?: string; timestamp?: Date | number },
  ): boolean;
  broadcastTicketScanEvent(
    payload: TicketRealtimePayload,
    options?: { rooms?: RoomType | RoomType[]; excludeSocketId?: string; timestamp?: Date | number },
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

export declare function createRealtimeCore(options: RealtimeCoreOptions): RealtimeCore;
