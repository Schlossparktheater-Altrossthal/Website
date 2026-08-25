import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

const {
  requireAuthMock,
  hasPermissionMock,
  readSperrlisteSettingsMock,
  resolveBlocklistSettingsMock,
  fetchHolidayRangesForSettingsMock,
  baseSettings,
  defaultHolidayUrl,
  defaultPublicHolidayUrl,
} = vi.hoisted(() => {
  const url = "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-sachsen.ics";
  const publicUrl = "https://www.officeholidays.com/ics/germany/saxony";
  return {
    requireAuthMock: vi.fn(),
    hasPermissionMock: vi.fn(),
    readSperrlisteSettingsMock: vi.fn(),
    resolveBlocklistSettingsMock: vi.fn(),
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
      publicHolidaySource: {
        mode: "default" as const,
        url: null,
        effectiveUrl: publicUrl,
      },
      holidayStatus: {
        status: "unknown" as const,
        message: null,
        checkedAt: null,
      },
      publicHolidayStatus: {
        status: "unknown" as const,
        message: null,
        checkedAt: null,
      },
      updatedAt: null,
      cacheKey:
        "default|https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-sachsen.ics|default|https://www.officeholidays.com/ics/germany/saxony",
    },
    defaultHolidayUrl: url,
    defaultPublicHolidayUrl: publicUrl,
  } as const;
});

vi.mock("@/lib/rbac", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/permissions", () => ({ hasPermission: hasPermissionMock }));
vi.mock("@/lib/sperrliste-settings", () => ({
  HOLIDAY_SOURCE_MODES: ["default", "custom", "disabled"] as const,
  DEFAULT_SAXONY_PUBLIC_HOLIDAY_FEED: "https://www.officeholidays.com/ics/germany/saxony",
  getDefaultHolidaySourceUrl: vi.fn(() => defaultHolidayUrl),
  getDefaultPublicHolidaySourceUrl: vi.fn(() => defaultPublicHolidayUrl),
  readSperrlisteSettings: readSperrlisteSettingsMock,
  resolveBlocklistSettings: resolveBlocklistSettingsMock,
}));
vi.mock("@/lib/holidays", async () => {
  const actual = await vi.importActual<typeof import("@/lib/holidays")>("@/lib/holidays");
  return {
    ...actual,
    fetchHolidayRangesForSettings: fetchHolidayRangesForSettingsMock,
  };
});

describe("sperrliste settings check route", () => {
  const createRequest = (body: unknown) =>
    ({
      json: async () => body,
    }) as NextRequest;

  let previousDatabaseUrl: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    requireAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    hasPermissionMock.mockResolvedValue(true);
    readSperrlisteSettingsMock.mockResolvedValue(null);
    resolveBlocklistSettingsMock.mockReturnValue({ ...baseSettings });
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
      holidayStatus: { status: "ok", message: "OK", checkedAt },
      publicHolidayStatus: { status: "ok", message: "OK", checkedAt },
    });

    const response = await POST(
      createRequest({
        source: "holiday",
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
      publicHolidayStatus: {
        status: "ok",
        message: "OK",
        checkedAt: checkedAt.toISOString(),
      },
    });

    expect(fetchHolidayRangesForSettingsMock).toHaveBeenCalledTimes(1);
    const candidate = fetchHolidayRangesForSettingsMock.mock.calls[0][0];
    expect(candidate.holidaySource.mode).toBe("default");
    expect(candidate.holidaySource.effectiveUrl).toBe(defaultHolidayUrl);
    expect(candidate.publicHolidaySource.mode).toBe("default");
    expect(candidate.publicHolidaySource.effectiveUrl).toBe(defaultPublicHolidayUrl);
  });

  it("rejects custom URLs outside the allowlist", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(
      createRequest({
        source: "holiday",
        mode: "custom",
        url: "https://untrusted.example.com/ferien.ics",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Diese Quelle ist nicht erlaubt.",
    });

    expect(fetchHolidayRangesForSettingsMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
