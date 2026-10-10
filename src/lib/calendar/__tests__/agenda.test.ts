import { describe, expect, it } from "vitest";

import {
  computeAgendaTiming,
  computePersonSchedules,
  findParallelConflicts,
  segmentAgenda,
  summarizeSchedules,
  toTime,
  type AgendaItem,
} from "@/lib/calendar/agenda";
import type { AudienceContext } from "@/lib/calendar/audience";

const context: AudienceContext = {
  hasProduction: true,
  members: [
    { id: "max", name: "Max" },
    { id: "ben", name: "Ben" },
    { id: "anna", name: "Anna" },
  ],
  characters: [
    { id: "bastian", name: "Bastian" },
    { id: "atreju", name: "Atréju" },
  ],
  castings: [
    { characterId: "bastian", userId: "max", type: "primary" },
    { characterId: "atreju", userId: "ben", type: "primary" },
  ],
  scenes: [
    { id: "s1", label: "Sz. 1", characterIds: ["bastian", "atreju"] },
    { id: "s2", label: "Sz. 2", characterIds: ["atreju"] },
    { id: "s3", label: "Sz. 3", characterIds: ["bastian"] },
  ],
  departments: [{ id: "kostuem", name: "Kostüm", memberIds: ["anna", "ben"] }],
};

function item(id: string, patch: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id,
    type: "CUSTOM",
    sceneId: null,
    departmentId: null,
    title: id,
    location: "",
    description: "",
    durationMinutes: 30,
    fixedStart: "",
    track: 0,
    forEveryone: false,
    timesChanged: false,
    ...patch,
  };
}

const scene = (sceneId: string, patch: Partial<AgendaItem> = {}) =>
  item(`scene:${sceneId}`, { type: "SCENE", sceneId, ...patch });

const times = (timing: ReturnType<typeof computeAgendaTiming>, id: string) => {
  const entry = timing.times[id];
  return entry ? `${toTime(entry.start)}–${toTime(entry.end)}` : null;
};

describe("computeAgendaTiming", () => {
  it("chains durations from the start time", () => {
    const timing = computeAgendaTiming(
      [item("a", { durationMinutes: 20 }), item("b", { durationMinutes: 45 })],
      "18:00",
    );
    expect(times(timing, "a")).toBe("18:00–18:20");
    expect(times(timing, "b")).toBe("18:20–19:05");
    expect(toTime(timing.end)).toBe("19:05");
  });

  it("keeps pinned items and reports gaps and overlaps", () => {
    const timing = computeAgendaTiming(
      [
        item("a", { durationMinutes: 30 }),
        item("pinned", { fixedStart: "19:00", durationMinutes: 30 }),
        item("late", { fixedStart: "19:15", durationMinutes: 15 }),
      ],
      "18:00",
    );
    expect(times(timing, "pinned")).toBe("19:00–19:30");
    expect(timing.gaps.pinned).toBe(30);
    expect(timing.overlaps.late).toBe(15);
  });

  it("runs tracks in parallel and lets shared items wait for the longest", () => {
    const timing = computeAgendaTiming(
      [
        item("warmup", { forEveryone: true, durationMinutes: 15 }),
        scene("s1", { durationMinutes: 30 }),
        scene("s2", { durationMinutes: 30 }),
        item("fitting", { track: 1, durationMinutes: 90 }),
        item("notes", { forEveryone: true, durationMinutes: 20 }),
      ],
      "10:00",
    );
    expect(times(timing, "fitting")).toBe("10:15–11:45");
    expect(times(timing, "scene:s2")).toBe("10:45–11:15");
    expect(times(timing, "notes")).toBe("11:45–12:05");
  });

  it("handles events past midnight", () => {
    const timing = computeAgendaTiming([item("a", { fixedStart: "00:30" })], "23:00");
    expect(timing.times.a?.start).toBe(24 * 60 + 30);
  });
});

describe("computePersonSchedules", () => {
  it("builds windows from own items plus shared ones and measures waiting", () => {
    const items = [scene("s1"), scene("s2"), scene("s3")];
    const timing = computeAgendaTiming(items, "18:00");
    const schedules = computePersonSchedules(items, timing, context);
    const max = schedules.find((entry) => entry.userId === "max");
    expect(max?.wait).toBe(30);
    expect(toTime(max?.window.start ?? 0)).toBe("18:00");
    const stats = summarizeSchedules(schedules);
    expect(stats.longestWait).toEqual({ userId: "max", minutes: 30 });
  });

  it("extends windows with shared items, but not for people without own items", () => {
    const items = [scene("s2"), item("notes", { forEveryone: true })];
    const timing = computeAgendaTiming(items, "18:00");
    const schedules = computePersonSchedules(items, timing, context);
    expect(schedules.map((entry) => entry.userId)).toEqual(["ben"]);
    expect(toTime(schedules[0]?.window.end ?? 0)).toBe("19:00");
  });
});

describe("findParallelConflicts", () => {
  it("flags people in two simultaneous tracks", () => {
    const items = [
      scene("s2"),
      item("fitting", { type: "DEPARTMENT", departmentId: "kostuem", track: 1 }),
    ];
    const conflicts = findParallelConflicts(items, computeAgendaTiming(items, "18:00"), context);
    expect(conflicts).toEqual([{ a: "scene:s2", b: "fitting", userIds: ["ben"] }]);
  });
});

describe("segmentAgenda", () => {
  it("groups tracks between shared items", () => {
    const segments = segmentAgenda([
      item("warmup", { forEveryone: true }),
      scene("s1"),
      item("fitting", { track: 1 }),
      scene("s2"),
    ]);
    expect(segments).toHaveLength(2);
    const tracks = segments[1];
    expect(tracks?.kind === "tracks" && tracks.tracks.map((t) => t.items.length)).toEqual([2, 1]);
  });
});
