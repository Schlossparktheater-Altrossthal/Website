import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { upsertMock, requireAuthMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    availabilityDay: {
      upsert: upsertMock,
    },
  },
}));

vi.mock("@/lib/rbac", () => ({
  requireAuth: requireAuthMock,
}));

describe("availability POST route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ user: { id: "user-123" } });
    upsertMock.mockResolvedValue({ id: "availability-day-id" });
  });

  const createRequest = (body: unknown) =>
    ({
      json: async () => body,
    }) as NextRequest;

  it("allows zero minute values", async () => {
    const response = await POST(
      createRequest({
        date: "2024-05-01T00:00:00.000Z",
        kind: "PARTIAL",
        availableFromMin: 0,
        availableToMin: 0,
        note: "Early slot",
      }),
    );

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      availability: { id: "availability-day-id" },
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          availableFromMin: 0,
          availableToMin: 0,
        }),
        create: expect.objectContaining({
          availableFromMin: 0,
          availableToMin: 0,
        }),
      }),
    );
  });

  it("rejects invalid availableFromMin values", async () => {
    const response = await POST(
      createRequest({
        date: "2024-05-01T00:00:00.000Z",
        kind: "PARTIAL",
        availableFromMin: "0",
        availableToMin: 15,
      }),
    );

    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();

    const payload = await response.json();
    expect(payload).toEqual({
      error: "availableFromMin must be a non-negative integer or null",
    });
  });

  it("rejects negative minute values", async () => {
    const response = await POST(
      createRequest({
        date: "2024-05-01T00:00:00.000Z",
        kind: "PARTIAL",
        availableFromMin: 10,
        availableToMin: -5,
      }),
    );

    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();

    const payload = await response.json();
    expect(payload).toEqual({
      error: "availableToMin must be a non-negative integer or null",
    });
  });
});
