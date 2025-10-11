import { describe, expect, it, vi } from 'vitest';
import type { RoomType } from '@/lib/realtime/types';
import { createRealtimeCore } from '@/lib/realtime/shared';

type FakeSocketRecord = {
  socket: any;
  directEmits: Array<{ event: string; payload: unknown }>;
  roomEmits: Array<{ room: string; event: string; payload: unknown }>;
};

type RoomEmission = {
  room: string;
  events: Array<{ event: string; payload: unknown; excluded?: string }>;
};

type FakeIO = {
  io: any;
  sockets: Map<string, any>;
  rooms: Map<string, Set<string>>;
  globalEmits: Array<{ event: string; payload: unknown }>;
  roomEmits: RoomEmission[];
};

function createFakeSocket(id: string, userId?: string, userName?: string): FakeSocketRecord {
  const directEmits: Array<{ event: string; payload: unknown }> = [];
  const roomEmits: Array<{ room: string; event: string; payload: unknown }> = [];
  const socket = {
    id,
    data: {
      userId,
      userName,
      rooms: new Set<RoomType>(),
    },
    emit: vi.fn((event: string, payload: unknown) => {
      directEmits.push({ event, payload });
    }),
    to: vi.fn((room: string) => ({
      emit: (event: string, payload: unknown) => {
        roomEmits.push({ room, event, payload });
      },
    })),
  };

  return { socket, directEmits, roomEmits };
}

function createFakeIO(): FakeIO {
  const sockets = new Map<string, any>();
  const rooms = new Map<string, Set<string>>();
  const globalEmits: Array<{ event: string; payload: unknown }> = [];
  const roomEmits: RoomEmission[] = [];

  const io = {
    emit: vi.fn((event: string, payload: unknown) => {
      globalEmits.push({ event, payload });
    }),
    to: vi.fn((room: string) => {
      const entry: RoomEmission = { room, events: [] };
      roomEmits.push(entry);
      return {
        emit: (event: string, payload: unknown) => {
          entry.events.push({ event, payload });
        },
        except: (socketId: string) => ({
          emit: (event: string, payload: unknown) => {
            entry.events.push({ event, payload, excluded: socketId });
          },
        }),
      };
    }),
    sockets: {
      sockets,
      adapter: { rooms },
    },
  };

  return { io, sockets, rooms, globalEmits, roomEmits };
}

describe('createRealtimeCore', () => {
  it('emits online stats updates only to subscribed sockets', () => {
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console });

    const { socket: client, directEmits } = createFakeSocket('socket-1', 'user-1', 'Alice');
    fakeIO.sockets.set('socket-1', client);

    core.trackConnection({ userId: 'user-1', socketId: 'socket-1', userName: 'Alice' });
    core.addOnlineStatsSubscriber('socket-1');
    core.emitOnlineStatsUpdate();

    expect(directEmits).toHaveLength(1);
    expect(directEmits[0].event).toBe('online_stats_update');
    expect((directEmits[0].payload as any).stats.totalOnline).toBe(1);
    expect(fakeIO.globalEmits).toHaveLength(0);
  });

  it('tracks rehearsal presence and forwards events to the room', () => {
    const trackSpy = vi.fn();
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console, trackPresenceEvent: trackSpy });

    const participant = createFakeSocket('socket-2', 'user-2', 'Bob');
    fakeIO.sockets.set('socket-2', participant.socket);

    core.emitRehearsalPresence({ socket: participant.socket, room: 'rehearsal_demo', action: 'join' });

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy.mock.calls[0][0]).toMatchObject({
      userId: 'user-2',
      room: 'rehearsal_demo',
      action: 'join',
    });
    expect(participant.roomEmits).toContainEqual({
      room: 'rehearsal_demo',
      event: 'user_presence',
      payload: expect.objectContaining({ room: 'rehearsal_demo', action: 'join' }),
    });
  });

  it('broadcasts ticket scan events to global and show rooms', () => {
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console });

    core.broadcastTicketScanEvent({ scope: 'tickets', showId: 'abc' } as any);

    const rooms = fakeIO.roomEmits.map((entry) => entry.room);
    expect(rooms).toContain('global');
    expect(rooms).toContain('show_abc');

    const showEvents = fakeIO.roomEmits.find((entry) => entry.room === 'show_abc')?.events ?? [];
    expect(showEvents[0]?.event).toBe('ticket_scan_event');
  });

  it('returns rehearsal participants list', () => {
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console });

    const memberA = createFakeSocket('socket-a', 'user-a', 'Anna');
    const memberB = createFakeSocket('socket-b', 'user-b', 'Ben');
    const requester = createFakeSocket('socket-c', 'user-c', 'Cara');

    fakeIO.sockets.set('socket-a', memberA.socket);
    fakeIO.sockets.set('socket-b', memberB.socket);
    fakeIO.sockets.set('socket-c', requester.socket);
    fakeIO.rooms.set('rehearsal_test', new Set(['socket-a', 'socket-b']));

    core.emitRehearsalUsersList({ rehearsalId: 'test', socket: requester.socket });

    expect(requester.directEmits[0].event).toBe('rehearsal_users_list');
    expect((requester.directEmits[0].payload as any).users).toEqual([
      { id: 'user-a', name: 'Anna' },
      { id: 'user-b', name: 'Ben' },
    ]);
  });

  it('handles unknown server events gracefully', () => {
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console });

    expect(core.handleServerEvent('unknown_event', {})).toBe(false);
  });
});
