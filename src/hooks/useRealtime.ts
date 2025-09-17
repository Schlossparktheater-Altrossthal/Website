"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import type { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  RoomType,
  RealtimeEvent 
} from '@/lib/realtime/types';

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;

// Connection status type
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Main realtime hook
export function useRealtime() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<SocketInstance | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!session?.user || socket?.connected) return;

    setConnectionStatus('connecting');

    const socketInstance: SocketInstance = io({
      path: '/api/socket',
      addTrailingSlash: false,
      transports: ['websocket', 'polling'],
      forceNew: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('Socket.IO connected');
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
      
      // Auto-join user room
      if (session.user?.id) {
        socketInstance.emit('join_room', `user_${session.user.id}`);
      }
    });

    socketInstance.on('disconnect', (reason: string) => {
      console.log('Socket.IO disconnected:', reason);
      setConnectionStatus('disconnected');
    });

    socketInstance.on('connect_error', (error: Error) => {
      console.error('Socket.IO connection error:', error);
      setConnectionStatus('error');
      reconnectAttempts.current++;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        socketInstance.disconnect();
      }
    });

    // Ping/Pong for connection health
    const pingInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('ping');
      }
    }, 30000); // Ping every 30 seconds

    socketInstance.on('pong', () => {
      // Connection is healthy
    });

    // Cleanup on disconnect
    socketInstance.on('disconnect', () => {
      clearInterval(pingInterval);
    });

    setSocket(socketInstance);

    return () => {
      clearInterval(pingInterval);
      socketInstance.disconnect();
    };
  }, [session?.user, socket?.connected]);

  useEffect(() => {
    if (session?.user && !socket) {
      connect();
    } else if (!session?.user && socket) {
      socket.disconnect();
      setSocket(null);
      setConnectionStatus('disconnected');
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [session?.user, socket, connect]);

  // Utility functions
  const joinRoom = useCallback((room: RoomType) => {
    if (socket?.connected) {
      socket.emit('join_room', room);
    }
  }, [socket]);

  const leaveRoom = useCallback((room: RoomType) => {
    if (socket?.connected) {
      socket.emit('leave_room', room);
    }
  }, [socket]);

  const reconnect = useCallback(() => {
    if (socket && !socket.connected) {
      reconnectAttempts.current = 0;
      socket.connect();
    } else if (!socket) {
      connect();
    }
  }, [socket, connect]);

  return {
    socket,
    connectionStatus,
    onlineUsers,
    isConnected: connectionStatus === 'connected',
    joinRoom,
    leaveRoom,
    reconnect,
  };
}

// Specific hook for attendance updates
export function useAttendanceRealtime(
  rehearsalId: string | null,
  onUpdate: (event: any) => void
) {
  const { socket, joinRoom, leaveRoom } = useRealtime();
  const currentRoom = useRef<RoomType | null>(null);

  useEffect(() => {
    if (!socket || !rehearsalId) return;

    const room: RoomType = `rehearsal_${rehearsalId}`;
    
    // Join new room
    if (currentRoom.current !== room) {
      if (currentRoom.current) {
        leaveRoom(currentRoom.current);
      }
      joinRoom(room);
      currentRoom.current = room;
    }

    // Listen for attendance updates
    socket.on('attendance_updated', onUpdate);

    return () => {
      socket.off('attendance_updated', onUpdate);
      if (currentRoom.current) {
        leaveRoom(currentRoom.current);
        currentRoom.current = null;
      }
    };
  }, [socket, rehearsalId, onUpdate, joinRoom, leaveRoom]);
}

// Hook for user presence in rehearsal rooms
export function usePresence(
  rehearsalId: string | null,
  onPresenceChange?: (event: any) => void
) {
  const { socket, joinRoom, leaveRoom } = useRealtime();
  const [presentUsers, setPresentUsers] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    if (!socket || !rehearsalId) return;

    const room: RoomType = `rehearsal_${rehearsalId}`;
    joinRoom(room);

    const handlePresence = (event: any) => {
      setPresentUsers(prev => {
        if (event.action === 'join') {
          return prev.find(u => u.id === event.user.id) 
            ? prev 
            : [...prev, event.user];
        } else {
          return prev.filter(u => u.id !== event.user.id);
        }
      });
      onPresenceChange?.(event);
    };

    socket.on('user_presence', handlePresence);

    return () => {
      socket.off('user_presence', handlePresence);
      leaveRoom(room);
      setPresentUsers([]);
    };
  }, [socket, rehearsalId, joinRoom, leaveRoom, onPresenceChange]);

  return presentUsers;
}

// Hook for notifications
export function useNotificationRealtime(onNotification: (event: any) => void) {
  const { socket } = useRealtime();

  useEffect(() => {
    if (!socket) return;

    socket.on('notification_created', onNotification);

    return () => {
      socket.off('notification_created', onNotification);
    };
  }, [socket, onNotification]);
}

// Hook for rehearsal updates
export function useRehearsalRealtime(
  onRehearsalCreated?: (event: any) => void,
  onRehearsalUpdated?: (event: any) => void
) {
  const { socket } = useRealtime();

  useEffect(() => {
    if (!socket) return;

    if (onRehearsalCreated) {
      socket.on('rehearsal_created', onRehearsalCreated);
    }
    
    if (onRehearsalUpdated) {
      socket.on('rehearsal_updated', onRehearsalUpdated);
    }

    return () => {
      if (onRehearsalCreated) {
        socket.off('rehearsal_created', onRehearsalCreated);
      }
      if (onRehearsalUpdated) {
        socket.off('rehearsal_updated', onRehearsalUpdated);
      }
    };
  }, [socket, onRehearsalCreated, onRehearsalUpdated]);
}