import { describe, expect, it } from "vitest";

import { buildTimeline, shortNameList, type TimelineBlock } from "../event-timeline";

function block(id: string, startsAt: string | null, endsAt: string | null): TimelineBlock {
  return {
    id,
    label: id,
    kind: "CUSTOM",
    startsAt,
    endsAt,
    location: null,
    description: null,
    who: null,
    mine: false,
    outcome: null,
  };
}

describe("buildTimeline", () => {
  it("fasst überlappende Punkte zu einer Zeile zusammen", () => {
    const rows = buildTimeline([
      block("a", "2026-10-04T12:00:00Z", "2026-10-04T13:00:00Z"),
      block("b", "2026-10-04T12:30:00Z", "2026-10-04T13:30:00Z"),
      block("c", "2026-10-04T13:30:00Z", "2026-10-04T14:00:00Z"),
    ]);
    expect(rows.map((row) => row.blocks.map((entry) => entry.id))).toEqual([["a", "b"], ["c"]]);
    expect(rows[0].end).toBe("2026-10-04T13:30:00Z");
  });

  it("lässt Punkte ohne Uhrzeit einzeln", () => {
    const rows = buildTimeline([block("a", null, null), block("b", null, null)]);
    expect(rows).toHaveLength(2);
  });
});

describe("shortNameList", () => {
  it("kürzt lange Listen", () => {
    expect(shortNameList(["A", "B", "C", "D", "E"])).toBe("A, B, C +2");
    expect(shortNameList([])).toBeNull();
  });
});
