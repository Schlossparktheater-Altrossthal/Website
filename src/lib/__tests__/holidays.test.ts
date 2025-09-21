import { addDays, format } from "date-fns";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

import { SAXONY_SCHOOL_HOLIDAYS } from "@/data/saxony-school-holidays";
import { getSaxonySchoolHolidayRanges } from "@/lib/holidays";

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
    const expected = SAXONY_SCHOOL_HOLIDAYS.filter(
      (range) => range.endDate >= thresholdStart && range.startDate <= thresholdEnd,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(ranges).toEqual(expected);
  });
});
