import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

const {
  requireAuthMock,
  hasPermissionMock,
  readSperrlisteSettingsMock,
  resolveSperrlisteSettingsMock,
  fetchHolidayRangesForSettingsMock,
  baseSettings,
  defaultHolidayUrl,
} = vi.hoisted(() => {
  const url = "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-sachsen.ics";
  return {
    requireAuthMock: vi.fn(),
    hasPermissionMock: vi.fn(),
    readSperrlisteSettingsMock: vi.fn(),
    resolveSperrlisteSettingsMock: vi.fn(),
    fetchHolidayRangesForSettingsMock: vi.fn(),
    baseSettings: {
      id: "default",
      freezeDays: 7,
      preferredWeekdays: [6, 0],
      exceptionWeekdays: [5],
      holidaySource: {
        mode: "default" as const,
        url: null,
        effectiveUrl: url,
      },
      holidayStatus: {
        status: "unknown" as const,
        message: null,
        checkedAt: null,
      },
      updatedAt: null,
      cacheKey: "default|https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-sachsen.ics",
    },
    defaultHolidayUrl: url,
  } as const;
});

vi.mock("@/lib/rbac", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/permissions", () => ({ hasPermission: hasPermissionMock }));
vi.mock("@/lib/sperrliste-settings", () => ({
  HOLIDAY_SOURCE_MODES: ["default", "custom", "disabled"] as const,
  getDefaultHolidaySourceUrl: vi.fn(() => defaultHolidayUrl),
  readSperrlisteSettings: readSperrlisteSettingsMock,
  resolveSperrlisteSettings: resolveSperrlisteSettingsMock,
}));
vi.mock("@/lib/holidays", async () => {
  const actual = await vi.importActual<typeof import("@/lib/holidays")>("@/lib/holidays");
  return {
    ...actual,
    fetchHolidayRangesForSettings: fetchHolidayRangesForSettingsMock,
  };
});

describe("sperrliste settings check route", () => {
  const createRequest = (body: unknown) => ({
    json: async () => body,
  }) as NextRequest;

  let previousDatabaseUrl: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    requireAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    hasPermissionMock.mockResolvedValue(true);
    readSperrlisteSettingsMock.mockResolvedValue(null);
    resolveSperrlisteSettingsMock.mockReturnValue({ ...baseSettings });
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://example.invalid/test";
  });

  afterEach(() => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it("passes through to the default feed when allowed", async () => {
    const checkedAt = new Date("2025-01-02T15:30:00Z");
    fetchHolidayRangesForSettingsMock.mockResolvedValue({
      ranges: [],
      status: { status: "ok", message: "OK", checkedAt },
    });

    const response = await POST(
      createRequest({
        mode: "default",
        url: "",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      holidayStatus: {
        status: "ok",
        message: "OK",
        checkedAt: checkedAt.toISOString(),
      },
    });

    expect(fetchHolidayRangesForSettingsMock).toHaveBeenCalledTimes(1);
    const candidate = fetchHolidayRangesForSettingsMock.mock.calls[0][0];
    expect(candidate.holidaySource.mode).toBe("default");
    expect(candidate.holidaySource.effectiveUrl).toBe(defaultHolidayUrl);
  });

  it("rejects custom URLs outside the allowlist", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(
      createRequest({
        mode: "custom",
        url: "https://untrusted.example.com/ferien.ics",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Diese Ferienquelle ist nicht erlaubt.",
    });

    expect(fetchHolidayRangesForSettingsMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
