import { realtimeService } from './service';
import type {
  AttendanceUpdatedEvent,
  RehearsalCreatedEvent, 
  RehearsalUpdatedEvent,
  NotificationCreatedEvent
} from './types';

/**
 * Server-side utilities for triggering real-time events
 * Use these functions from your API routes and server actions
 */

export class RealtimeTriggers {
  /**
   * Broadcast attendance update to all users in rehearsal room
   */
  static async broadcastAttendanceUpdate(data: {
    rehearsalId: string;
    targetUserId: string;
    status: 'yes' | 'no' | 'emergency';
    comment?: string;
    actorUserId: string;
  }) {
    const event: Omit<AttendanceUpdatedEvent, 'timestamp'> = {
      type: 'attendance_updated',
      rehearsalId: data.rehearsalId,
      targetUserId: data.targetUserId,
      status: data.status as AttendanceUpdatedEvent['status'],
      comment: data.comment,
      actorUserId: data.actorUserId,
    };

    realtimeService.broadcastAttendanceUpdate(event);
  }

  /**
   * Broadcast new rehearsal creation to all members
   */
  static async broadcastRehearsalCreated(data: {
    rehearsal: {
      id: string;
      title: string;
      start: string;
      end: string;
      location: string;
    };
    targetUserIds: string[];
  }) {
    const event: Omit<RehearsalCreatedEvent, 'timestamp'> = {
      type: 'rehearsal_created',
      rehearsal: data.rehearsal,
      targetUserIds: data.targetUserIds,
    };

    realtimeService.broadcastRehearsalCreated(event);
  }

  /**
   * Broadcast rehearsal updates to relevant users
   */
  static async broadcastRehearsalUpdated(data: {
    rehearsalId: string;
    changes: {
      title?: string;
      start?: string;
      end?: string;
      location?: string;
      status?: string;
    };
    targetUserIds: string[];
  }) {
    const event: Omit<RehearsalUpdatedEvent, 'timestamp'> = {
      type: 'rehearsal_updated',
      rehearsalId: data.rehearsalId,
      changes: data.changes,
      targetUserIds: data.targetUserIds,
    };

    realtimeService.broadcastRehearsalUpdated(event);
  }

  /**
   * Send notification to specific user
   */
  static async sendNotification(data: {
    targetUserId: string;
    title: string;
    body?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    const event: Omit<NotificationCreatedEvent, 'timestamp'> = {
      type: 'notification_created',
      notification: {
        id: `notif_${Date.now()}`,
        title: data.title,
        body: data.body,
        rehearsalId: data.metadata?.rehearsalId,
        type: data.type,
        actionUrl: data.actionUrl,
        metadata: data.metadata,
      },
      targetUserId: data.targetUserId,
    };

    realtimeService.sendNotification(event);
  }

  /**
   * Get list of users currently online in a rehearsal
   */
  static async getOnlineUsersInRehearsal(rehearsalId: string): Promise<string[]> {
    const io = realtimeService.getIO();
    if (!io) {
      return [];
    }

    try {
      const room = io.sockets.adapter.rooms.get(`rehearsal_${rehearsalId}`);
      return room ? Array.from(room) : [];
    } catch (error) {
      console.error('Error getting online users:', error);
      return [];
    }
  }

  /**
   * Check if a specific user is online
   */
  static async isUserOnline(userId: string): Promise<boolean> {
    const io = realtimeService.getIO();
    if (!io) {
      return false;
    }

    try {
      const room = io.sockets.adapter.rooms.get(`user_${userId}`);
      return room ? room.size > 0 : false;
    } catch (error) {
      console.error('Error checking user online status:', error);
      return false;
    }
  }

  /**
   * Get total count of online users
   */
  static async getOnlineUserCount(): Promise<number> {
    const io = realtimeService.getIO();
    if (!io) {
      return 0;
    }

    try {
      return io.sockets.sockets.size;
    } catch (error) {
      console.error('Error getting online user count:', error);
      return 0;
    }
  }
}

// Convenience exports
export const {
  broadcastAttendanceUpdate,
  broadcastRehearsalCreated,
  broadcastRehearsalUpdated,
  sendNotification,
  getOnlineUsersInRehearsal,
  isUserOnline,
  getOnlineUserCount,
} = RealtimeTriggers;