import { AttendanceStatus } from "@prisma/client";

// Base Event Interface
export interface BaseRealtimeEvent {
  type: string;
  timestamp: string;
  userId?: string;
}

// Specific Event Types
export interface AttendanceUpdatedEvent extends BaseRealtimeEvent {
  type: 'attendance_updated';
  rehearsalId: string;
  targetUserId: string;
  status: AttendanceStatus | null;
  comment?: string;
  actorUserId: string; // Who made the change
}

export interface RehearsalCreatedEvent extends BaseRealtimeEvent {
  type: 'rehearsal_created';
  rehearsal: {
    id: string;
    title: string;
    start: string;
    end: string;
    location: string;
  };
  targetUserIds: string[];
}

export interface RehearsalUpdatedEvent extends BaseRealtimeEvent {
  type: 'rehearsal_updated';
  rehearsalId: string;
  changes: {
    title?: string;
    start?: string;
    end?: string;
    location?: string;
    status?: string;
  };
  targetUserIds: string[];
}

export interface NotificationCreatedEvent extends BaseRealtimeEvent {
  type: 'notification_created';
  notification: {
    id: string;
    title: string;
    body?: string;
    rehearsalId?: string;
  };
  targetUserId: string;
}

export interface UserPresenceEvent extends BaseRealtimeEvent {
  type: 'user_presence';
  action: 'join' | 'leave';
  room: string;
  user: {
    id: string;
    name: string;
  };
}

// Union Type for all events
export type RealtimeEvent = 
  | AttendanceUpdatedEvent
  | RehearsalCreatedEvent
  | RehearsalUpdatedEvent
  | NotificationCreatedEvent
  | UserPresenceEvent;

// Room Types
export type RoomType = 
  | `user_${string}`           // User-specific room
  | `rehearsal_${string}`      // Rehearsal-specific room
  | `show_${string}`           // Show-specific room
  | 'global';                  // Global announcements

// Client to Server Events
export interface ClientToServerEvents {
  join_room: (room: RoomType) => void;
  leave_room: (room: RoomType) => void;
  ping: () => void;
}

// Server to Client Events  
export interface ServerToClientEvents {
  attendance_updated: (event: AttendanceUpdatedEvent) => void;
  rehearsal_created: (event: RehearsalCreatedEvent) => void;
  rehearsal_updated: (event: RehearsalUpdatedEvent) => void;
  notification_created: (event: NotificationCreatedEvent) => void;
  user_presence: (event: UserPresenceEvent) => void;
  pong: () => void;
}

// Socket Data
export interface InterServerEvents {
  // For multi-server scaling (later)
}

export interface SocketData {
  userId?: string;
  userName?: string;
  rooms: Set<RoomType>;
}