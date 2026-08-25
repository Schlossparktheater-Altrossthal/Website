import { describe, expect, it, vi } from "vitest";
import type { RealtimeCoreOptions } from "@/lib/realtime/shared";
import type { RoomType, TicketRealtimePayload } from "@/lib/realtime/types";
import { createRealtimeCore } from "@/lib/realtime/shared";

type RoomEvent = { event: string; payload: unknown; excluded?: string };

type FakeSocket = {
  id: string;
  data: { userId?: string; userName?: string; rooms: Set<RoomType> };
  emit: (event: string, payload: unknown) => void;
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
};

type FakeSocketRecord = {
  socket: FakeSocket;
  directEmits: Array<{ event: string; payload: unknown }>;
  roomEmits: Array<{ room: string; event: string; payload: unknown }>;
};

type RoomEmission = {
  room: string;
  events: RoomEvent[];
};

type FakeServer = RealtimeCoreOptions["io"];

type FakeIO = {
  io: FakeServer;
  sockets: Map<string, FakeSocket>;
  rooms: Map<string, Set<string>>;
  globalEmits: Array<{ event: string; payload: unknown }>;
  roomEmits: RoomEmission[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertOnlineStatsPayload(
  payload: unknown,
): asserts payload is { stats: { totalOnline: number } } {
  if (!isRecord(payload)) {
    throw new Error("Expected payload to be a record");
  }

  const { stats } = payload;
  if (!isRecord(stats) || typeof stats.totalOnline !== "number") {
    throw new Error("Expected stats with totalOnline number");
  }
}

function assertRehearsalUsersPayload(
  payload: unknown,
): asserts payload is { users: Array<{ id: string; name?: string }> } {
  if (!isRecord(payload) || !Array.isArray(payload.users)) {
    throw new Error("Expected payload with users array");
  }

  payload.users.forEach((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      throw new Error("Expected user entries with an id");
    }

    if ("name" in entry && entry.name !== undefined && typeof entry.name !== "string") {
      throw new Error("Expected optional name to be a string");
    }
  });
}

function createFakeSocket(id: string, userId?: string, userName?: string): FakeSocketRecord {
  const directEmits: Array<{ event: string; payload: unknown }> = [];
  const roomEmits: Array<{ room: string; event: string; payload: unknown }> = [];
  const socket: FakeSocket = {
    id,
    data: {
      userId,
      userName,
      rooms: new Set<RoomType>(),
    },
    emit: (event: string, payload: unknown) => {
      directEmits.push({ event, payload });
    },
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        roomEmits.push({ room, event, payload });
      },
    }),
  };

  return { socket, directEmits, roomEmits };
}

function createFakeIO(): FakeIO {
  const sockets = new Map<string, FakeSocket>();
  const rooms = new Map<string, Set<string>>();
  const globalEmits: Array<{ event: string; payload: unknown }> = [];
  const roomEmits: RoomEmission[] = [];

  const io = {
    emit: (event: string, payload: unknown) => {
      globalEmits.push({ event, payload });
    },
    to: (room: string) => {
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
    },
    sockets: {
      sockets,
      adapter: { rooms },
    },
  } as unknown as FakeServer;

  return { io, sockets, rooms, globalEmits, roomEmits };
}

describe("createRealtimeCore", () => {
  it("emits online stats updates only to subscribed sockets", () => {
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console });

    const { socket: client, directEmits } = createFakeSocket("socket-1", "user-1", "Alice");
    fakeIO.sockets.set("socket-1", client);

    core.trackConnection({ userId: "user-1", socketId: "socket-1", userName: "Alice" });
    core.addOnlineStatsSubscriber("socket-1");
    core.emitOnlineStatsUpdate();

    expect(directEmits).toHaveLength(1);
    expect(directEmits[0].event).toBe("online_stats_update");
    assertOnlineStatsPayload(directEmits[0].payload);
    expect(directEmits[0].payload.stats.totalOnline).toBe(1);
    expect(fakeIO.globalEmits).toHaveLength(0);
  });

  it("tracks rehearsal presence and forwards events to the room", () => {
    const trackSpy = vi.fn();
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({
      io: fakeIO.io,
      logger: console,
      trackPresenceEvent: trackSpy,
    });

    const participant = createFakeSocket("socket-2", "user-2", "Bob");
    fakeIO.sockets.set("socket-2", participant.socket);

    core.emitRehearsalPresence({
      socket: participant.socket,
      room: "rehearsal_demo",
      action: "join",
    });

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy.mock.calls[0][0]).toMatchObject({
      userId: "user-2",
      room: "rehearsal_demo",
      action: "join",
    });
    expect(participant.roomEmits).toContainEqual({
      room: "rehearsal_demo",
      event: "user_presence",
      payload: expect.objectContaining({ room: "rehearsal_demo", action: "join" }),
    });
  });

  it("broadcasts ticket scan events to global and show rooms", () => {
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console });

    const payload: TicketRealtimePayload = {
      scope: "tickets",
      showId: "abc",
      delta: { upserts: [], deletes: [] },
    };

    core.broadcastTicketScanEvent(payload);

    const rooms = fakeIO.roomEmits.map((entry) => entry.room);
    expect(rooms).toContain("global");
    expect(rooms).toContain("show_abc");

    const showEvents = fakeIO.roomEmits.find((entry) => entry.room === "show_abc")?.events ?? [];
    expect(showEvents[0]?.event).toBe("ticket_scan_event");
  });

  it("returns rehearsal participants list", () => {
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console });

    const memberA = createFakeSocket("socket-a", "user-a", "Anna");
    const memberB = createFakeSocket("socket-b", "user-b", "Ben");
    const requester = createFakeSocket("socket-c", "user-c", "Cara");

    fakeIO.sockets.set("socket-a", memberA.socket);
    fakeIO.sockets.set("socket-b", memberB.socket);
    fakeIO.sockets.set("socket-c", requester.socket);
    fakeIO.rooms.set("rehearsal_test", new Set(["socket-a", "socket-b"]));

    core.emitRehearsalUsersList({ rehearsalId: "test", socket: requester.socket });

    expect(requester.directEmits[0].event).toBe("rehearsal_users_list");
    assertRehearsalUsersPayload(requester.directEmits[0].payload);
    expect(requester.directEmits[0].payload.users).toEqual([
      { id: "user-a", name: "Anna" },
      { id: "user-b", name: "Ben" },
    ]);
  });

  it("handles unknown server events gracefully", () => {
    const fakeIO = createFakeIO();
    const core = createRealtimeCore({ io: fakeIO.io, logger: console });

    expect(core.handleServerEvent("unknown_event", {})).toBe(false);
  });
});
