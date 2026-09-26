import { describe, expect, it } from "vitest";

import { buildIcsCalendar, escapeIcsText, foldIcsLine } from "@/lib/calendar/ics";

describe("escapeIcsText", () => {
  it("maskiert Sonderzeichen und Zeilenumbrüche", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe(String.raw`a\,b\;c\\d\ne`);
  });
});

describe("foldIcsLine", () => {
  it("bricht nach 75 Oktetten um, ohne Umlaute zu zerteilen", () => {
    const folded = foldIcsLine(`SUMMARY:${"ä".repeat(60)}`);
    const encoder = new TextEncoder();
    for (const part of folded.split("\r\n")) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"ä".repeat(60)}`);
  });
});

describe("buildIcsCalendar", () => {
  const now = new Date("2026-09-26T10:00:00Z");

  it("schreibt Termine mit Zeit, ganztägige Einträge und Absagen", () => {
    const ics = buildIcsCalendar({
      name: "Test",
      now,
      events: [
        {
          uid: "rehearsal-1@test",
          summary: "Probe",
          start: { kind: "dateTime", value: new Date("2026-10-01T17:00:00Z") },
          end: { kind: "dateTime", value: new Date("2026-10-01T19:30:00Z") },
          location: "Bühne, Saal",
          cancelled: true,
          lastModified: now,
        },
        {
          uid: "blocked-day-1@test",
          summary: "Gesperrt",
          start: { kind: "date", value: "2026-10-03" },
          end: { kind: "date", value: "2026-10-04" },
          transparent: true,
        },
      ],
    });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261001T170000Z");
    expect(ics).toContain("DTEND:20261001T193000Z");
    expect(ics).toContain("LOCATION:Bühne\\, Saal");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261003");
    expect(ics).toContain("DTEND;VALUE=DATE:20261004");
    expect(ics).toContain("TRANSP:TRANSPARENT");
    expect(ics).toContain("DTSTAMP:20260926T100000Z");
  });
});
