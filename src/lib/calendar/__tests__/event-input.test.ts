import { describe, expect, it } from "vitest";

import { expandEntryDayKeys } from "@/lib/calendar/event-kinds";
import { calendarEventInputSchema, resolveCalendarEventTimes } from "@/lib/calendar/event-input";
import { formatIsoDateInTimeZone } from "@/lib/date-time";

function resolve(input: Record<string, unknown>) {
  return resolveCalendarEventTimes(
    calendarEventInputSchema.parse({ title: "Klausur", kind: "OTHER", allDay: false, ...input }),
  );
}

describe("resolveCalendarEventTimes", () => {
  it("keeps a multi-day event without end time until the end of the last day", () => {
    const { start, end } = resolve({
      date: "2026-10-09",
      endDate: "2026-10-11",
      startTime: "18:00",
    });
    expect(end).not.toBeNull();
    expect(formatIsoDateInTimeZone(end?.toISOString() ?? "")).toBe("2026-10-11");
    const keys = expandEntryDayKeys({
      start: start.toISOString(),
      end: end?.toISOString() ?? null,
      dayKey: "2026-10-09",
    });
    expect(keys).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
  });

  it("leaves a single-day event without end time open", () => {
    expect(resolve({ date: "2026-10-09", startTime: "18:00" }).end).toBeNull();
  });

  it("uses the given end time on the last day", () => {
    const { end } = resolve({
      date: "2026-10-09",
      endDate: "2026-10-10",
      startTime: "18:00",
      endTime: "12:00",
    });
    expect(formatIsoDateInTimeZone(end?.toISOString() ?? "")).toBe("2026-10-10");
  });
});
