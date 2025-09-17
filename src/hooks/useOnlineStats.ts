"use client";

import { useEffect, useState } from 'react';
import { useRealtime } from './useRealtime';

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
    socket.on('online_stats_update', (data: Omit<OnlineStats, 'lastUpdate'>) => {
      setStats(prev => ({
        ...data,
        lastUpdate: new Date(),
      }));
    });

    // Listen for user join/leave events
    socket.on('user_joined', (userData: { id: string; name: string }) => {
      setStats(prev => ({
        totalOnline: prev.totalOnline + 1,
        onlineUsers: [...prev.onlineUsers, { ...userData, joinedAt: new Date() }],
        lastUpdate: new Date(),
      }));
    });

    socket.on('user_left', (userData: { id: string }) => {
      setStats(prev => ({
        totalOnline: Math.max(0, prev.totalOnline - 1),
        onlineUsers: prev.onlineUsers.filter(user => user.id !== userData.id),
        lastUpdate: new Date(),
      }));
    });

    return () => {
      socket.off('online_stats_update');
      socket.off('user_joined');
      socket.off('user_left');
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
  const { socket, isConnected } = useRealtime();
  const [onlineUsers, setOnlineUsers] = useState<Array<{
    id: string;
    name: string;
    joinedAt: Date;
  }>>([]);

  useEffect(() => {
    if (!socket || !isConnected || !rehearsalId) return;

    // Join rehearsal room to get presence updates
    socket.emit('join_room', `rehearsal_${rehearsalId}`);

    // Request current online users in rehearsal
    socket.emit('get_rehearsal_users', rehearsalId);

    // Listen for presence updates
    socket.on('user_presence', (event) => {
      if (event.action === 'join') {
        setOnlineUsers(prev => {
          // Avoid duplicates
          if (prev.find(u => u.id === event.user.id)) return prev;
          return [...prev, { ...event.user, joinedAt: new Date() }];
        });
      } else if (event.action === 'leave') {
        setOnlineUsers(prev => prev.filter(u => u.id !== event.user.id));
      }
    });

    // Handle initial user list response
    socket.on('rehearsal_users_list', (users: Array<{ id: string; name: string }>) => {
      setOnlineUsers(users.map(user => ({ ...user, joinedAt: new Date() })));
    });

    return () => {
      socket.off('user_presence');
      socket.off('rehearsal_users_list');
      if (rehearsalId) {
        socket.emit('leave_room', `rehearsal_${rehearsalId}`);
      }
    };
  }, [socket, isConnected, rehearsalId]);

  return {
    onlineUsers,
    count: onlineUsers.length,
    isLoading: !isConnected,
  };
}