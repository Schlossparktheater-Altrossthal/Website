import { describe, expect, it, beforeEach, vi } from "vitest";

import { POST } from "../route";

const {
  requireAuthMock,
  hasPermissionMock,
  transactionMock,
  checkInTicketMock,
  MockTicketCheckInError,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  hasPermissionMock: vi.fn(),
  transactionMock: vi.fn(),
  checkInTicketMock: vi.fn(),
  MockTicketCheckInError: class MockTicketCheckInError extends Error {},
}));

vi.mock("@/lib/rbac", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: hasPermissionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/tickets/service", () => ({
  checkInTicket: checkInTicketMock,
  TicketCheckInError: MockTicketCheckInError,
}));

describe("ticket check-in API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    hasPermissionMock.mockResolvedValue(true);
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({}),
    );
  });

  const createRequest = (body: unknown) => ({
    json: async () => body,
  }) as unknown as Request;

  it("checks in tickets when the user is allowed", async () => {
    const ticket = {
      id: "ticket-1",
      code: "CODE-123",
      status: "checked_in",
      holderName: "Hans",
      eventId: "event-1",
      updatedAt: new Date("2024-05-01T10:00:00.000Z"),
    };
    const scanEvent = {
      id: "scan-1",
      ticketId: "ticket-1",
      occurredAt: new Date("2024-05-01T10:00:00.000Z"),
      processedAt: new Date("2024-05-01T10:01:00.000Z"),
      statusBefore: "pending",
      statusAfter: "checked_in",
      source: "scanner",
      dedupeKey: null,
      serverSeq: 12,
      provisional: false,
    };

    checkInTicketMock.mockResolvedValue({
      status: "checked_in",
      provisional: false,
      serverSeq: 12,
      alreadyCheckedIn: false,
      ticket,
      scanEvent,
    });

    const response = await POST(
      createRequest({
        code: "CODE-123",
        dedupeKey: "scan-1",
      }),
    );

    expect(requireAuthMock).toHaveBeenCalled();
    expect(hasPermissionMock).toHaveBeenCalledWith({ id: "user-1" }, "mitglieder.scan");
    expect(checkInTicketMock).toHaveBeenCalledWith(expect.any(Object), {
      ticketId: null,
      code: "CODE-123",
      dedupeKey: "scan-1",
      occurredAt: null,
      source: "scanner",
      clientId: null,
      clientMutationId: null,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "checked_in",
      provisional: false,
      serverSeq: 12,
      alreadyCheckedIn: false,
      message: "Ticket erfolgreich eingecheckt.",
      ticket: {
        id: "ticket-1",
        code: "CODE-123",
        status: "checked_in",
        holderName: "Hans",
        eventId: "event-1",
        updatedAt: "2024-05-01T10:00:00.000Z",
      },
      event: {
        id: "scan-1",
        ticketId: "ticket-1",
        occurredAt: "2024-05-01T10:00:00.000Z",
        processedAt: "2024-05-01T10:01:00.000Z",
        statusBefore: "pending",
        statusAfter: "checked_in",
        source: "scanner",
        dedupeKey: null,
        serverSeq: 12,
        provisional: false,
      },
    });
  });

  it("rejects check-ins when the user is not allowed", async () => {
    hasPermissionMock.mockResolvedValue(false);

    const response = await POST(
      createRequest({
        code: "CODE-123",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(checkInTicketMock).not.toHaveBeenCalled();
  });
});
