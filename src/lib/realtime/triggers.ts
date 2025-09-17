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
    const io = realtimeService.getIO();
    if (!io) {
      console.warn('Socket.IO not initialized, skipping attendance broadcast');
      return;
    }

    const event: AttendanceUpdatedEvent = {
      type: 'attendance_updated',
      rehearsalId: data.rehearsalId,
      targetUserId: data.targetUserId,
      status: data.status as any, // Type assertion for now
      comment: data.comment,
      actorUserId: data.actorUserId,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to rehearsal room
    io.to(`rehearsal_${data.rehearsalId}`).emit('attendance_updated', event);
    
    // Also send to target user's personal room
    io.to(`user_${data.targetUserId}`).emit('attendance_updated', event);

    console.log(`Broadcasted attendance update for user ${data.targetUserId}: ${data.status}`);
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
    const io = realtimeService.getIO();
    if (!io) {
      console.warn('Socket.IO not initialized, skipping rehearsal broadcast');
      return;
    }

    const event: RehearsalCreatedEvent = {
      type: 'rehearsal_created',
      rehearsal: data.rehearsal,
      targetUserIds: data.targetUserIds,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all members
    io.to('members').emit('rehearsal_created', event);

    console.log(`Broadcasted rehearsal creation: ${data.rehearsal.title}`);
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
    const io = realtimeService.getIO();
    if (!io) {
      console.warn('Socket.IO not initialized, skipping rehearsal update broadcast');
      return;
    }

    const event: RehearsalUpdatedEvent = {
      type: 'rehearsal_updated',
      rehearsalId: data.rehearsalId,
      changes: data.changes,
      targetUserIds: data.targetUserIds,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to rehearsal room and affected users
    io.to(`rehearsal_${data.rehearsalId}`).emit('rehearsal_updated', event);
    data.targetUserIds.forEach(userId => {
      io.to(`user_${userId}`).emit('rehearsal_updated', event);
    });

    console.log(`Broadcasted rehearsal update for ${data.rehearsalId}`);
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
    metadata?: Record<string, any>;
  }) {
    const io = realtimeService.getIO();
    if (!io) {
      console.warn('Socket.IO not initialized, skipping notification');
      return;
    }

    const event: NotificationCreatedEvent = {
      type: 'notification_created',
      notification: {
        id: `notif_${Date.now()}`,
        title: data.title,
        body: data.body,
        type: data.type || 'info',
        actionUrl: data.actionUrl,
        read: false,
        metadata: data.metadata,
      },
      targetUserId: data.targetUserId,
      timestamp: new Date().toISOString(),
    };

    // Send to user's personal room
    io.to(`user_${data.targetUserId}`).emit('notification_created', event);

    console.log(`Sent notification to user ${data.targetUserId}: ${data.title}`);
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