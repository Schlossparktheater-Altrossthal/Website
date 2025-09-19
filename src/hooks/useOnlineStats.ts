"use client";

import { useEffect, useState } from 'react';
import { useRealtime } from './useRealtime';
import type {
  OnlineStatsUpdateEvent,
  UserJoinedEvent,
  UserLeftEvent,
  RehearsalUsersListEvent,
  UserPresenceEvent,
  RoomType,
} from '@/lib/realtime/types';

interface OnlineStats {
  totalOnline: number;
  onlineUsers: Array<{
    id: string;
    name: string;
    joinedAt: Date;
  }>;
  lastUpdate: Date;
}

/**
 * Hook für Live-Online-Statistiken aller Mitglieder
 */
export function useOnlineStats() {
  const { socket, isConnected } = useRealtime();
  const [stats, setStats] = useState<OnlineStats>({
    totalOnline: 0,
    onlineUsers: [],
    lastUpdate: new Date(),
  });

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Request initial stats
    socket.emit('get_online_stats');

    // Listen for stats updates
    const handleStatsUpdate = (event: OnlineStatsUpdateEvent) => {
      setStats({
        totalOnline: event.stats.totalOnline,
        onlineUsers: event.stats.onlineUsers.map(user => ({
          id: user.id,
          name: user.name ?? 'Unbekannt',
          joinedAt: user.lastSeen ? new Date(user.lastSeen) : new Date(event.timestamp),
        })),
        lastUpdate: new Date(event.timestamp),
      });
    };

    const handleUserJoined = (event: UserJoinedEvent) => {
      const joinedAt = new Date(event.timestamp);
      setStats(prev => ({
        totalOnline: prev.totalOnline + 1,
        onlineUsers: [...prev.onlineUsers, {
          id: event.user.id,
          name: event.user.name ?? 'Unbekannt',
          joinedAt,
        }],
        lastUpdate: joinedAt,
      }));
    };

    const handleUserLeft = (event: UserLeftEvent) => {
      setStats(prev => ({
        totalOnline: Math.max(0, prev.totalOnline - 1),
        onlineUsers: prev.onlineUsers.filter(user => user.id !== event.user.id),
        lastUpdate: new Date(event.timestamp),
      }));
    };

    socket.on('online_stats_update', handleStatsUpdate);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);

    return () => {
      socket.off('online_stats_update', handleStatsUpdate);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      if (socket.connected) {
        socket.emit('unsubscribe_online_stats');
      }
    };
  }, [socket, isConnected]);

  return {
    ...stats,
    isLoading: !isConnected,
  };
}

/**
 * Hook für Rehearsal-spezifische Online-Benutzer
 */
export function useRehearsalOnlineUsers(rehearsalId: string | null) {
  const { socket, isConnected, joinRoom, leaveRoom } = useRealtime();
  const [onlineUsers, setOnlineUsers] = useState<Array<{
    id: string;
    name: string;
    joinedAt: Date;
  }>>([]);

  useEffect(() => {
    if (!socket || !isConnected || !rehearsalId) return;

    const room: RoomType = `rehearsal_${rehearsalId}`;
    joinRoom(room);

    // Request current online users in rehearsal
    socket.emit('get_rehearsal_users', rehearsalId);

    // Listen for presence updates
    const handlePresence = (event: UserPresenceEvent) => {
      if (event.room !== room) return;

      if (event.action === 'join') {
        setOnlineUsers(prev => {
          if (prev.some(user => user.id === event.user.id)) {
            return prev;
          }
          return [...prev, { id: event.user.id, name: event.user.name, joinedAt: new Date(event.timestamp) }];
        });
      } else if (event.action === 'leave') {
        setOnlineUsers(prev => prev.filter(user => user.id !== event.user.id));
      }
    };

    const handleInitialUsers = (event: RehearsalUsersListEvent) => {
      if (event.rehearsalId !== rehearsalId) return;
      const updatedAt = new Date(event.timestamp);
      setOnlineUsers(event.users.map(user => ({
        id: user.id,
        name: user.name ?? 'Unbekannt',
        joinedAt: updatedAt,
      })));
    };

    socket.on('user_presence', handlePresence);
    socket.on('rehearsal_users_list', handleInitialUsers);

    return () => {
      socket.off('user_presence', handlePresence);
      socket.off('rehearsal_users_list', handleInitialUsers);
      leaveRoom(room);
      setOnlineUsers([]);
    };
  }, [socket, isConnected, rehearsalId, joinRoom, leaveRoom]);

  return {
    onlineUsers,
    count: onlineUsers.length,
    isLoading: !isConnected,
  };
}