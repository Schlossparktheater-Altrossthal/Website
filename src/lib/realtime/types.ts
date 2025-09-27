import { AttendanceStatus } from "@prisma/client";

import type { InventoryItemRecord, TicketRecord } from "@/lib/offline/types";
import type { ServerSyncEvent } from "@/lib/offline/sync-client";
import type { ServerAnalytics } from "@/lib/server-analytics";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";

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
    type?: 'info' | 'warning' | 'success' | 'error';
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  };
  targetUserId: string;
}

export interface InventoryRealtimePayload {
  scope: 'inventory';
  serverSeq?: number;
  events?: ServerSyncEvent[];
  mutationId?: string | null;
  clientId?: string | null;
  source?: string | null;
  delta?: {
    upserts?: InventoryItemRecord[];
    deletes?: string[];
  };
}

export interface TicketRealtimePayload {
  scope: 'tickets';
  serverSeq?: number;
  events?: ServerSyncEvent[];
  mutationId?: string | null;
  clientId?: string | null;
  source?: string | null;
  showId?: string | null;
  delta?: {
    upserts?: TicketRecord[];
    deletes?: string[];
  };
}

export interface InventoryRealtimeEvent extends BaseRealtimeEvent {
  type: 'inventory_event';
  payload: InventoryRealtimePayload;
}

export interface TicketScanRealtimeEvent extends BaseRealtimeEvent {
  type: 'ticket_scan_event';
  payload: TicketRealtimePayload;
}

export interface OnboardingDashboardUpdateEvent extends BaseRealtimeEvent {
  type: 'onboarding_dashboard_update';
  onboardingId: string;
  dashboard: OnboardingDashboardData;
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

export interface OnlineStatsSnapshot {
  totalOnline: number;
  onlineUsers: Array<{
    id: string;
    name?: string;
    lastSeen?: string;
  }>;
}

export interface OnlineStatsUpdateEvent extends BaseRealtimeEvent {
  type: 'online_stats_update';
  stats: OnlineStatsSnapshot;
}

export interface ServerAnalyticsRealtimeEvent extends BaseRealtimeEvent {
  type: 'server_analytics_update';
  analytics: ServerAnalytics;
}

export interface UserJoinedEvent extends BaseRealtimeEvent {
  type: 'user_joined';
  user: {
    id: string;
    name?: string;
  };
}

export interface UserLeftEvent extends BaseRealtimeEvent {
  type: 'user_left';
  user: {
    id: string;
    name?: string;
  };
}

export interface RehearsalUsersListEvent extends BaseRealtimeEvent {
  type: 'rehearsal_users_list';
  rehearsalId: string;
  users: Array<{
    id: string;
    name?: string;
  }>;
}

// Union Type for all events
export type RealtimeEvent =
  | AttendanceUpdatedEvent
  | RehearsalCreatedEvent
  | RehearsalUpdatedEvent
  | NotificationCreatedEvent
  | InventoryRealtimeEvent
  | TicketScanRealtimeEvent
  | OnboardingDashboardUpdateEvent
  | UserPresenceEvent
  | OnlineStatsUpdateEvent
  | ServerAnalyticsRealtimeEvent
  | UserJoinedEvent
  | UserLeftEvent
  | RehearsalUsersListEvent;

// Room Types
export type RoomType =
  | `user_${string}`           // User-specific room
  | `rehearsal_${string}`      // Rehearsal-specific room
  | `show_${string}`           // Show-specific room
  | `onboarding_${string}`     // Onboarding dashboard room
  | 'global';                  // Global announcements

// Client to Server Events
export interface ClientToServerEvents {
  join_room: (room: RoomType) => void;
  leave_room: (room: RoomType) => void;
  ping: () => void;
  get_online_stats: () => void;
  unsubscribe_online_stats: () => void;
  get_rehearsal_users: (rehearsalId: string) => void;
  get_server_analytics: () => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  attendance_updated: (event: AttendanceUpdatedEvent) => void;
  rehearsal_created: (event: RehearsalCreatedEvent) => void;
  rehearsal_updated: (event: RehearsalUpdatedEvent) => void;
  notification_created: (event: NotificationCreatedEvent) => void;
  inventory_event: (event: InventoryRealtimeEvent) => void;
  ticket_scan_event: (event: TicketScanRealtimeEvent) => void;
  onboarding_dashboard_update: (event: OnboardingDashboardUpdateEvent) => void;
  user_presence: (event: UserPresenceEvent) => void;
  online_stats_update: (event: OnlineStatsUpdateEvent) => void;
  server_analytics_update: (event: ServerAnalyticsRealtimeEvent) => void;
  user_joined: (event: UserJoinedEvent) => void;
  user_left: (event: UserLeftEvent) => void;
  rehearsal_users_list: (event: RehearsalUsersListEvent) => void;
  pong: () => void;
}

// Socket Data
export type InterServerEvents = Record<string, never>;

export interface SocketData {
  userId?: string;
  userName?: string;
  handshakeVerified?: boolean;
  handshake?: {
    issuedAt: number;
    expiresAt: number;
  };
  rooms: Set<RoomType>;
}
