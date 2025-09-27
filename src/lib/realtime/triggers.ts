import type { OnboardingDashboardData } from '@/lib/onboarding/dashboard-schemas';

import { emitRealtimeEvent } from './event-client';

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
    await emitRealtimeEvent('attendance_updated', {
      rehearsalId: data.rehearsalId,
      targetUserId: data.targetUserId,
      status: data.status ?? null,
      comment: data.comment,
      actorUserId: data.actorUserId,
    });
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
    await emitRealtimeEvent('rehearsal_created', {
      rehearsal: data.rehearsal,
      targetUserIds: data.targetUserIds,
    });
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
    await emitRealtimeEvent('rehearsal_updated', {
      rehearsalId: data.rehearsalId,
      changes: data.changes,
      targetUserIds: data.targetUserIds,
    });
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
    await emitRealtimeEvent('notification_created', {
      targetUserId: data.targetUserId,
      notification: {
        id: `notif_${Date.now()}`,
        title: data.title,
        body: data.body,
        type: data.type,
        actionUrl: data.actionUrl,
        metadata: data.metadata,
        rehearsalId: data.metadata?.rehearsalId,
      },
    });
  }

  /**
   * Broadcast updated onboarding dashboard snapshot to listeners
   */
  static async broadcastOnboardingDashboardUpdate(data: {
    onboardingId: string;
    dashboard: OnboardingDashboardData;
    broadcastToGlobal?: boolean;
  }) {
    await emitRealtimeEvent('onboarding_dashboard_update', {
      onboardingId: data.onboardingId,
      dashboard: data.dashboard,
      broadcastToGlobal: Boolean(data.broadcastToGlobal),
    });
  }

  /**
   * Get list of users currently online in a rehearsal
   */
  static async getOnlineUsersInRehearsal(rehearsalId: string): Promise<string[]> {
    console.warn('[RealtimeTriggers] getOnlineUsersInRehearsal is not supported in external server mode', rehearsalId);
    return [];
  }

  /**
   * Check if a specific user is online
   */
  static async isUserOnline(userId: string): Promise<boolean> {
    console.warn('[RealtimeTriggers] isUserOnline is not supported in external server mode', userId);
    return false;
  }

  /**
   * Get total count of online users
   */
  static async getOnlineUserCount(): Promise<number> {
    console.warn('[RealtimeTriggers] getOnlineUserCount is not supported in external server mode');
    return 0;
  }
}

// Convenience exports
export const {
  broadcastAttendanceUpdate,
  broadcastRehearsalCreated,
  broadcastRehearsalUpdated,
  sendNotification,
  broadcastOnboardingDashboardUpdate,
  getOnlineUsersInRehearsal,
  isUserOnline,
  getOnlineUserCount,
} = RealtimeTriggers;
