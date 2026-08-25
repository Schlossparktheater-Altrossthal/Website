import type { NextRequest } from "next/server";
import { BlockedDayKind } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedSperrlisteSettings } from "@/lib/sperrliste-settings";
import { POST } from "../route";

const {
  createMock,
  requireAuthMock,
  hasPermissionMock,
  readSettingsMock,
  resolveSettingsMock,
  databaseEnabledMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  requireAuthMock: vi.fn(),
  hasPermissionMock: vi.fn(),
  readSettingsMock: vi.fn(),
  resolveSettingsMock: vi.fn(),
  databaseEnabledMock: vi.fn(() => true),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blockedDay: {
      create: createMock,
    },
  },
}));

vi.mock("@/lib/rbac", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: hasPermissionMock,
}));

vi.mock("@/lib/sperrliste-settings", () => ({
  DEFAULT_FREEZE_DAYS: 7,
  readSperrlisteSettings: readSettingsMock,
  resolveBlocklistSettings: resolveSettingsMock,
}));

vi.mock("@/lib/dev-database", () => ({
  databaseEnabled: databaseEnabledMock,
}));

const createSettings = (freezeDays: number): ResolvedSperrlisteSettings => ({
  id: "default",
  freezeDays,
  preferredWeekdays: [],
  exceptionWeekdays: [],
  holidaySource: { mode: "default", url: null, effectiveUrl: null },
  holidayStatus: { status: "unknown", message: null, checkedAt: null },
  updatedAt: null,
  cacheKey: `default|${freezeDays}`,
});

describe("block days route", () => {
  const createRequest = (body: unknown) =>
    ({
      json: async () => body,
    }) as NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-10T12:00:00.000Z"));

    databaseEnabledMock.mockReturnValue(true);
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    hasPermissionMock.mockResolvedValue(true);
    readSettingsMock.mockResolvedValue(null);
    resolveSettingsMock.mockReturnValue(createSettings(7));
    createMock.mockResolvedValue({
      id: "blocked-1",
      date: new Date("2025-01-21T00:00:00.000Z"),
      reason: null,
      kind: BlockedDayKind.BLOCKED,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects block days within the configured freeze window", async () => {
    resolveSettingsMock.mockReturnValue(createSettings(10));

    const response = await POST(
      createRequest({
        date: "2025-01-15",
        reason: "Urlaub",
      }),
    );

    expect(response.status).toBe(400);

    const payload = await response.json();
    expect(payload.error).toContain("20. Januar 2025");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("allows block days after the freeze window", async () => {
    resolveSettingsMock.mockReturnValue(createSettings(10));

    const response = await POST(
      createRequest({
        date: "2025-01-21",
        reason: "Urlaub",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "blocked-1",
      date: "2025-01-21",
      reason: null,
      kind: BlockedDayKind.BLOCKED,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("does not enforce a freeze when configured with zero days", async () => {
    resolveSettingsMock.mockReturnValue(createSettings(0));
    createMock.mockResolvedValue({
      id: "blocked-2",
      date: new Date("2025-01-11T00:00:00.000Z"),
      reason: null,
      kind: BlockedDayKind.BLOCKED,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    const response = await POST(
      createRequest({
        date: "2025-01-11",
        reason: null,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "blocked-2",
      date: "2025-01-11",
      reason: null,
      kind: BlockedDayKind.BLOCKED,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });
});
