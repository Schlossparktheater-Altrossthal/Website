"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomType,
  UserPresenceEvent,
} from '@/lib/realtime/types';

// Allow essentially unlimited reconnects; avoid noisy hard-fail in production
const MAX_RECONNECT_ATTEMPTS: number = Number.POSITIVE_INFINITY;
const PING_INTERVAL_MS = 30_000;
const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL;
const REALTIME_PATH = process.env.NEXT_PUBLIC_REALTIME_PATH || '/socket.io';

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;
type AttendanceUpdateMessage = Parameters<ServerToClientEvents['attendance_updated']>[0];
type NotificationMessage = Parameters<ServerToClientEvents['notification_created']>[0];
type RehearsalCreatedMessage = Parameters<ServerToClientEvents['rehearsal_created']>[0];
type RehearsalUpdatedMessage = Parameters<ServerToClientEvents['rehearsal_updated']>[0];

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface RealtimeContextValue {
  socket: SocketInstance | null;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  joinRoom: (room: RoomType) => void;
  leaveRoom: (room: RoomType) => void;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<SocketInstance | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const reconnectAttempts = useRef(0);
  const [connectionVersion, setConnectionVersion] = useState(0);
  const socketRef = useRef<SocketInstance | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    const userName = session?.user?.name ?? undefined;

    if (!userId) {
      stopPingInterval();
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    // Resolve realtime URL; fall back to current host if env points to localhost and user is remote
    const resolveRealtimeUrl = (): string | undefined => {
      if (typeof window === 'undefined') return REALTIME_URL;
      if (!REALTIME_URL) return undefined;
      try {
        const url = new URL(REALTIME_URL);
        const hostIsLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
        const browserHostIsLocal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        if (hostIsLocal && !browserHostIsLocal) {
          return `${window.location.protocol}//${window.location.hostname}:${url.port || '4001'}`;
        }
        return REALTIME_URL;
      } catch {
        return REALTIME_URL;
      }
    };

    const options = {
      path: REALTIME_PATH,
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      auth: {
        userId,
        userName,
      },
    };

    const target = resolveRealtimeUrl();
    const instance: SocketInstance = target
      ? io(target, options)
      : io(options);

    socketRef.current = instance;
    setSocket(instance);

    instance.on('connect', () => {
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;

      instance.emit('join_room', `user_${userId}`);
      instance.emit('join_room', 'global');

      stopPingInterval();
      pingIntervalRef.current = setInterval(() => {
        if (instance.connected) {
          instance.emit('ping');
        }
      }, PING_INTERVAL_MS);
    });

    instance.on('disconnect', () => {
      setConnectionStatus('disconnected');
      stopPingInterval();
    });

    instance.on('connect_error', (error: Error) => {
      console.warn('Socket.IO connection error:', error?.message || error);
      setConnectionStatus('error');
      reconnectAttempts.current += 1;
      // With infinite attempts configured, let socket.io keep trying with backoff
    });

    instance.on('pong', () => {
      // Keep connection alive acknowledgement
    });

    return () => {
      stopPingInterval();
      instance.removeAllListeners();
      instance.disconnect();
      if (socketRef.current === instance) {
        socketRef.current = null;
        setSocket(null);
      }
    };
  }, [session?.user?.id, session?.user?.name, connectionVersion, stopPingInterval]);

  const joinRoom = useCallback((room: RoomType) => {
    const instance = socketRef.current;
    if (instance?.connected) {
      instance.emit('join_room', room);
    }
  }, []);

  const leaveRoom = useCallback((room: RoomType) => {
    const instance = socketRef.current;
    if (instance?.connected) {
      instance.emit('leave_room', room);
    }
  }, []);

  const reconnect = useCallback(() => {
    if (!session?.user?.id) return;

    reconnectAttempts.current = 0;
    stopPingInterval();

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }

    setConnectionVersion((version) => version + 1);
    setConnectionStatus('connecting');
  }, [session?.user?.id, stopPingInterval]);

  const value = useMemo(
    (): RealtimeContextValue => ({
      socket,
      connectionStatus,
      isConnected: connectionStatus === 'connected',
      joinRoom,
      leaveRoom,
      reconnect,
    }),
    [socket, connectionStatus, joinRoom, leaveRoom, reconnect],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

export function useAttendanceRealtime(
  rehearsalId: string | null,
  onUpdate: (event: AttendanceUpdateMessage) => void,
) {
  const { socket, joinRoom, leaveRoom } = useRealtime();
  const currentRoom = useRef<RoomType | null>(null);

  useEffect(() => {
    if (!socket || !rehearsalId) return;

    const room: RoomType = `rehearsal_${rehearsalId}`;

    if (currentRoom.current !== room) {
      if (currentRoom.current) {
        leaveRoom(currentRoom.current);
      }
      joinRoom(room);
      currentRoom.current = room;
    }

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

export function usePresence(
  rehearsalId: string | null,
  onPresenceChange?: (event: UserPresenceEvent) => void,
) {
  const { socket, joinRoom, leaveRoom } = useRealtime();
  const [presentUsers, setPresentUsers] = useState<UserPresenceEvent['user'][]>([]);

  useEffect(() => {
    if (!socket || !rehearsalId) return;

    const room: RoomType = `rehearsal_${rehearsalId}`;
    joinRoom(room);

    const handlePresence = (event: UserPresenceEvent) => {
      setPresentUsers((prev) => {
        if (event.action === 'join') {
          return prev.some((user) => user.id === event.user.id)
            ? prev
            : [...prev, event.user];
        }
        return prev.filter((user) => user.id !== event.user.id);
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

export function useNotificationRealtime(
  onNotification: (event: NotificationMessage) => void,
) {
  const { socket } = useRealtime();

  useEffect(() => {
    if (!socket) return;

    socket.on('notification_created', onNotification);

    return () => {
      socket.off('notification_created', onNotification);
    };
  }, [socket, onNotification]);
}

export function useRehearsalRealtime(
  onRehearsalCreated?: (event: RehearsalCreatedMessage) => void,
  onRehearsalUpdated?: (event: RehearsalUpdatedMessage) => void,
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
