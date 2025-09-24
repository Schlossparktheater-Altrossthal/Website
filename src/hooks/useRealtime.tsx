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
import type { ManagerOptions, SocketOptions } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomType,
  UserPresenceEvent,
} from '@/lib/realtime/types';
import { useOfflineSyncClient } from '@/lib/offline/hooks';

// Allow essentially unlimited reconnects; avoid noisy hard-fail in production
const MAX_RECONNECT_ATTEMPTS: number = Number.POSITIVE_INFINITY;
const PING_INTERVAL_MS = 30_000;
const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL;
const REALTIME_PATH = process.env.NEXT_PUBLIC_REALTIME_PATH || '/socket.io';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function isLocalHostname(hostname: string | undefined): boolean {
  if (!hostname) return false;
  return LOCAL_HOSTNAMES.has(hostname);
}

function normalizeSocketPath(path: string | undefined | null): string {
  if (typeof path !== 'string') {
    return '/socket.io';
  }
  const trimmed = path.trim();
  if (!trimmed) {
    return '/socket.io';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;
type AttendanceUpdateMessage = Parameters<ServerToClientEvents['attendance_updated']>[0];
type NotificationMessage = Parameters<ServerToClientEvents['notification_created']>[0];
type RehearsalCreatedMessage = Parameters<ServerToClientEvents['rehearsal_created']>[0];
type RehearsalUpdatedMessage = Parameters<ServerToClientEvents['rehearsal_updated']>[0];
type InventoryRealtimeMessage = Parameters<ServerToClientEvents['inventory_event']>[0];
type TicketRealtimeMessage = Parameters<ServerToClientEvents['ticket_scan_event']>[0];
type HandshakeAuthPayload = {
  userId: string;
  userName?: string;
  token: string;
};

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
  const { client: syncClient } = useOfflineSyncClient();
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
    const fallbackUserName = session?.user?.name ?? undefined;
    const abortController = new AbortController();
    let disposed = false;
    let latestAuth: HandshakeAuthPayload | null = null;

    const cleanupSocket = () => {
      stopPingInterval();
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };

    if (!userId) {
      cleanupSocket();
      setConnectionStatus('disconnected');
      return () => {
        disposed = true;
        abortController.abort();
      };
    }

    const requestHandshake = async (signal?: AbortSignal): Promise<HandshakeAuthPayload> => {
      const response = await fetch('/api/realtime/handshake', {
        method: 'GET',
        cache: 'no-store',
        signal,
      });
      if (!response.ok) {
        throw new Error(`Handshake request failed (${response.status})`);
      }
      const data = (await response.json()) as {
        token?: unknown;
        userId?: unknown;
        userName?: unknown;
      };
      if (data?.userId && data.userId !== userId) {
        throw new Error('Handshake user mismatch');
      }
      if (!data || typeof data.token !== 'string' || !data.token.trim()) {
        throw new Error('Handshake token missing');
      }
      const canonicalName =
        typeof data.userName === 'string' && data.userName.trim() ? data.userName : fallbackUserName;
      return {
        userId,
        userName: canonicalName,
        token: data.token,
      };
    };

    const resolveConnectionEndpoint = (): { target: string | undefined; path: string } => {
      const normalizedPath = normalizeSocketPath(REALTIME_PATH);

      if (typeof window === 'undefined') {
        return { target: REALTIME_URL, path: normalizedPath };
      }

      if (!REALTIME_URL) {
        return { target: undefined, path: normalizedPath };
      }

      try {
        const parsed = new URL(REALTIME_URL, window.location.origin);
        const basePath = parsed.pathname.replace(/\/$/, '');
        let resolvedPath = normalizedPath;
        if (basePath && !resolvedPath.startsWith(basePath)) {
          resolvedPath = `${basePath}${resolvedPath.startsWith('/') ? '' : '/'}${resolvedPath}`;
        }

        let origin = parsed.origin;
        const hostIsLocal = isLocalHostname(parsed.hostname);
        const browserHostIsLocal = isLocalHostname(window.location.hostname);
        if (hostIsLocal && !browserHostIsLocal) {
          const port = parsed.port || '4001';
          origin = `${window.location.protocol}//${window.location.hostname}:${port}`;
        }

        return { target: origin, path: resolvedPath };
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Realtime] Failed to parse NEXT_PUBLIC_REALTIME_URL', error);
        }

        if (REALTIME_URL.startsWith('/')) {
          return { target: undefined, path: normalizedPath };
        }

        return { target: REALTIME_URL, path: normalizedPath };
      }
    };

    let connectionCleanup: (() => void) | null = null;

    const establishConnection = async () => {
      setConnectionStatus('connecting');

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      try {
        const handshake = await requestHandshake(abortController.signal);
        if (disposed) return;
        latestAuth = handshake;

        const { target: connectionTarget, path: socketPath } = resolveConnectionEndpoint();

        const options: Partial<ManagerOptions & SocketOptions> = {
          path: socketPath,
          transports: ['websocket', 'polling'],
          forceNew: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
          auth: handshake,
        };

        const instance: SocketInstance = connectionTarget ? io(connectionTarget, options) : io(options);

        const applyAuth = (auth: HandshakeAuthPayload | null) => {
          if (!auth) return;
          instance.auth = auth;
          if (instance.io?.opts) {
            (instance.io.opts as Partial<ManagerOptions & SocketOptions>).auth = auth;
          }
        };

        socketRef.current = instance;
        setSocket(instance);

        instance.on('connect', () => {
          if (disposed) {
            return;
          }
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
          if (disposed) return;
          setConnectionStatus('disconnected');
          stopPingInterval();
        });

        const handleReconnectAttempt = async () => {
          try {
            const refreshed = await requestHandshake();
            if (disposed) return;
            latestAuth = refreshed;
            applyAuth(latestAuth);
          } catch (error) {
            console.warn('Failed to refresh realtime auth token', error);
          }
        };

        instance.io.on('reconnect_attempt', handleReconnectAttempt);

        instance.on('connect_error', async (error: Error) => {
          console.warn('Socket.IO connection error:', error?.message || error);
          setConnectionStatus('error');
          reconnectAttempts.current += 1;

          const message = String(error?.message || '').toLowerCase();
          if (message.includes('unauthorized') || message.includes('forbidden')) {
            try {
              const refreshed = await requestHandshake();
              if (disposed) return;
              latestAuth = refreshed;
              applyAuth(latestAuth);
              instance.connect();
            } catch (refreshError) {
              console.error('Realtime handshake refresh failed', refreshError);
            }
          }
          // With infinite attempts configured, let socket.io keep trying with backoff
        });

        instance.on('pong', () => {
          // Keep connection alive acknowledgement
        });

        applyAuth(latestAuth);

        connectionCleanup = () => {
          instance.io.off('reconnect_attempt', handleReconnectAttempt);
          instance.removeAllListeners();
          instance.disconnect();
        };
      } catch (error) {
        if (disposed) return;
        console.error('Failed to establish realtime connection', error);
        setConnectionStatus('error');
        cleanupSocket();
      }
    };

    void establishConnection();

    return () => {
      disposed = true;
      abortController.abort();
      stopPingInterval();
      connectionCleanup?.();
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, [session?.user?.id, session?.user?.name, connectionVersion, stopPingInterval]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleInventoryEvent = (event: InventoryRealtimeMessage) => {
      const payload = event?.payload;
      if (!payload) {
        return;
      }

      const scope = payload.scope ?? 'inventory';

      void syncClient
        .applyRealtimePayload({
          scope,
          serverSeq: payload.serverSeq,
          events: payload.events,
          delta: payload.delta,
        })
        .catch((error) => {
          console.warn('[Realtime] Failed to apply inventory realtime delta', error);
        });
    };

    const handleTicketEvent = (event: TicketRealtimeMessage) => {
      const payload = event?.payload;
      if (!payload) {
        return;
      }

      const scope = payload.scope ?? 'tickets';

      void syncClient
        .applyRealtimePayload({
          scope,
          serverSeq: payload.serverSeq,
          events: payload.events,
          delta: payload.delta,
        })
        .catch((error) => {
          console.warn('[Realtime] Failed to apply ticket realtime delta', error);
        });
    };

    socket.on('inventory_event', handleInventoryEvent);
    socket.on('ticket_scan_event', handleTicketEvent);

    return () => {
      socket.off('inventory_event', handleInventoryEvent);
      socket.off('ticket_scan_event', handleTicketEvent);
    };
  }, [socket, syncClient]);

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
