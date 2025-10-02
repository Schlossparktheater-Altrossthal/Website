import { addDays, format } from "date-fns";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

const { defaultHolidayUrl, defaultPublicHolidayUrl, resolvedSettings } = vi.hoisted(() => {
  const url = "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-sachsen.ics";
  const publicUrl = "https://www.feiertage-deutschland.de/kalender-download/ics/feiertage-sachsen.ics";
  return {
    defaultHolidayUrl: url,
    defaultPublicHolidayUrl: publicUrl,
    resolvedSettings: {
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
  } as const;
});

vi.mock("@/lib/sperrliste-settings", () => ({
  readSperrlisteSettings: vi.fn().mockResolvedValue(null),
  resolveSperrlisteSettings: vi
    .fn()
    .mockImplementation(() => ({
      ...resolvedSettings,
      holidaySource: { ...resolvedSettings.holidaySource },
      holidayStatus: { ...resolvedSettings.holidayStatus },
    })),
  applyHolidaySourceStatus: vi.fn().mockResolvedValue(undefined),
  getDefaultHolidaySourceUrl: vi.fn(() => defaultHolidayUrl),
  getDefaultPublicHolidaySourceUrl: vi.fn(() => defaultPublicHolidayUrl),
}));

import { SAXONY_PUBLIC_HOLIDAYS } from "@/data/saxony-public-holidays";
import { SAXONY_SCHOOL_HOLIDAYS } from "@/data/saxony-school-holidays";
import { getSaxonySchoolHolidayRanges, isHolidaySourceUrlAllowed } from "@/lib/holidays";

describe("getSaxonySchoolHolidayRanges", () => {
  let previousOutboundToggle: string | undefined;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    previousOutboundToggle = process.env.OUTBOUND_HTTP_DISABLED;
    delete process.env.OUTBOUND_HTTP_DISABLED;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));

    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch is disabled in tests"));

    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (previousOutboundToggle === undefined) {
      delete process.env.OUTBOUND_HTTP_DISABLED;
    } else {
      process.env.OUTBOUND_HTTP_DISABLED = previousOutboundToggle;
    }

    fetchSpy.mockRestore();
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it("falls back to the static Saxony dataset when remote feeds fail", async () => {
    const ranges = await getSaxonySchoolHolidayRanges();

    const thresholdStart = format(addDays(new Date(), -365), "yyyy-MM-dd");
    const thresholdEnd = format(addDays(new Date(), 365 * 3), "yyyy-MM-dd");
    const expected = [...SAXONY_SCHOOL_HOLIDAYS, ...SAXONY_PUBLIC_HOLIDAYS]
      .filter((range) => range.endDate >= thresholdStart && range.startDate <= thresholdEnd)
      .sort((a, b) => {
        const byStart = a.startDate.localeCompare(b.startDate);
        if (byStart !== 0) return byStart;
        const byEnd = a.endDate.localeCompare(b.endDate);
        if (byEnd !== 0) return byEnd;
        const byCategory = a.category.localeCompare(b.category);
        if (byCategory !== 0) return byCategory;
        const byTitle = a.title.localeCompare(b.title, "de-DE");
        if (byTitle !== 0) return byTitle;
        return a.id.localeCompare(b.id);
      });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(ranges).toEqual(expected);
  });
});

describe("isHolidaySourceUrlAllowed", () => {
  it("allows the configured default feed", () => {
    expect(isHolidaySourceUrlAllowed(defaultHolidayUrl)).toBe(true);
  });

  it("rejects non-HTTPS protocols", () => {
    expect(isHolidaySourceUrlAllowed("http://www.feiertage-deutschland.de/test.ics")).toBe(false);
  });

  it("rejects unknown hosts", () => {
    expect(isHolidaySourceUrlAllowed("https://untrusted.example.com/feed.ics")).toBe(false);
  });
});
