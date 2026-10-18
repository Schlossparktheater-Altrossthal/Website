import { AttendanceStatus } from "@prisma/client";

import type { TicketRecord } from "@/lib/offline/types";
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
  type: "attendance_updated";
  rehearsalId: string;
  targetUserId: string;
  status: AttendanceStatus | null;
  comment?: string;
  actorUserId: string; // Who made the change
}

export interface RehearsalCreatedEvent extends BaseRealtimeEvent {
  type: "rehearsal_created";
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
  type: "rehearsal_updated";
  rehearsalId: string;
  changes: {
    title?: string;
    start?: string;
    end?: string;
    location?: string;
    status?: string;
    /** Probenmodus: Anwesenheit, Zeiten oder Notizen geändert. */
    protocol?: boolean;
  };
  targetUserIds: string[];
}

export interface NotificationCreatedEvent extends BaseRealtimeEvent {
  type: "notification_created";
  notification: {
    id: string;
    title: string;
    body?: string;
    rehearsalId?: string;
    type?: "info" | "warning" | "success" | "error";
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  };
  targetUserId: string;
}

export interface TicketRealtimePayload {
  scope: "tickets";
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

export interface TicketScanRealtimeEvent extends BaseRealtimeEvent {
  type: "ticket_scan_event";
  payload: TicketRealtimePayload;
}

export interface OnboardingDashboardUpdateEvent extends BaseRealtimeEvent {
  type: "onboarding_dashboard_update";
  onboardingId: string;
  dashboard: OnboardingDashboardData;
}

export interface UserPresenceEvent extends BaseRealtimeEvent {
  type: "user_presence";
  action: "join" | "leave";
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
  peakConcurrentUsers?: number;
}

export interface OnlineStatsUpdateEvent extends BaseRealtimeEvent {
  type: "online_stats_update";
  stats: OnlineStatsSnapshot;
}

export interface ServerAnalyticsRealtimeEvent extends BaseRealtimeEvent {
  type: "server_analytics_update";
  analytics: ServerAnalytics;
}

export interface UserJoinedEvent extends BaseRealtimeEvent {
  type: "user_joined";
  user: {
    id: string;
    name?: string;
  };
}

export interface UserLeftEvent extends BaseRealtimeEvent {
  type: "user_left";
  user: {
    id: string;
    name?: string;
  };
}

export interface RehearsalUsersListEvent extends BaseRealtimeEvent {
  type: "rehearsal_users_list";
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
  | TicketScanRealtimeEvent
  | OnboardingDashboardUpdateEvent
  | UserPresenceEvent
  | OnlineStatsUpdateEvent
  | ServerAnalyticsRealtimeEvent
  | UserJoinedEvent
  | UserLeftEvent
  | RehearsalUsersListEvent;

// Live-Mitlesen im Skript (docs/Plan/skript-mitlesen-plan.md, realtime-server/src/script-live.js)
export interface ScriptLiveLeader {
  userId: string;
  name: string;
  /** Gerät (Socket) mit der zuletzt bewegten Stelle. */
  deviceId: string;
  index: number | null;
  fraction: number | null;
  at: number | null;
}

export interface ScriptLiveRosterEvent {
  versionId: string;
  /** Anzahl Personen im Raum (mehrere Geräte zählen einmal). */
  readers: number;
  leaders: ScriptLiveLeader[];
}

export interface ScriptLivePositionEvent {
  userId: string;
  deviceId: string;
  index: number;
  fraction: number;
  at: number;
}

/** Statistische Live-Stelle (Achsen-Zeichen, src/lib/skript/live/estimate.js). */
export interface ScriptLiveEstimateEvent {
  versionId: string;
  pos: number;
  /** Zeichen pro Sekunde. */
  rate: number;
  confident: boolean;
  /** Personen, die gerade in die Schätzung eingehen. */
  active: number;
  at: number;
}

/** Nur an Führende (E7): wer liest mit, wer folgt, wer ist abgehängt. */
/** Laufende gemeinsame Aufnahme im Raum (E10); `sessionId: null` = keine. */
export interface ScriptLiveRecordingEvent {
  versionId: string;
  sessionId: string | null;
  startedAt: number | null;
}

export interface ScriptLiveStatusEvent {
  versionId: string;
  /** Live-Stelle, auf die sich die Einteilung bezieht (Achsen-Zeichen). */
  livePos: number;
  following: number;
  reading: number;
  ahead: number;
  /** Länger als 2 min nicht bewegt. */
  away: number;
  behind: { userId: string; name: string; pos: number }[];
}

// Room Types
export type RoomType =
  | `user_${string}` // User-specific room
  | `rehearsal_${string}` // Rehearsal-specific room
  | `show_${string}` // Show-specific room
  | `onboarding_${string}` // Onboarding dashboard room
  | "global"; // Global announcements

// Client to Server Events
export interface ClientToServerEvents {
  join_room: (room: RoomType) => void;
  leave_room: (room: RoomType) => void;
  ping: () => void;
  get_online_stats: () => void;
  unsubscribe_online_stats: () => void;
  get_rehearsal_users: (rehearsalId: string) => void;
  get_server_analytics: () => void;
  script_live_join: (payload: {
    versionId: string;
    followable: boolean;
    /** Eigene Rollen fürs Protokoll einer Aufnahme. */
    roleIds?: string[];
  }) => void;
  script_live_update: (payload: { followable: boolean }) => void;
  script_live_position: (payload: {
    index: number;
    fraction: number;
    pos: number;
    echo: boolean;
  }) => void;
  script_live_leave: () => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  attendance_updated: (event: AttendanceUpdatedEvent) => void;
  rehearsal_created: (event: RehearsalCreatedEvent) => void;
  rehearsal_updated: (event: RehearsalUpdatedEvent) => void;
  notification_created: (event: NotificationCreatedEvent) => void;
  ticket_scan_event: (event: TicketScanRealtimeEvent) => void;
  onboarding_dashboard_update: (event: OnboardingDashboardUpdateEvent) => void;
  user_presence: (event: UserPresenceEvent) => void;
  online_stats_update: (event: OnlineStatsUpdateEvent) => void;
  server_analytics_update: (event: ServerAnalyticsRealtimeEvent) => void;
  user_joined: (event: UserJoinedEvent) => void;
  user_left: (event: UserLeftEvent) => void;
  rehearsal_users_list: (event: RehearsalUsersListEvent) => void;
  script_live_roster: (event: ScriptLiveRosterEvent) => void;
  script_live_position: (event: ScriptLivePositionEvent) => void;
  script_live_estimate: (event: ScriptLiveEstimateEvent) => void;
  script_live_status: (event: ScriptLiveStatusEvent) => void;
  script_live_recording: (event: ScriptLiveRecordingEvent) => void;
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
