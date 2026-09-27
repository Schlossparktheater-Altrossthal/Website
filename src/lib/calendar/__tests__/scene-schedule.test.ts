import { describe, expect, it } from "vitest";

import type { AudienceContext } from "@/lib/calendar/audience";
import { computePersonalWindows, scenesByPerson } from "@/lib/calendar/scene-schedule";

const context: AudienceContext = {
  hasProduction: true,
  members: [
    { id: "max", name: "Max" },
    { id: "ben", name: "Ben" },
    { id: "lena", name: "Lena" },
  ],
  characters: [
    { id: "bastian", name: "Bastian" },
    { id: "atreju", name: "Atréju" },
  ],
  castings: [
    { characterId: "bastian", userId: "max", type: "primary" },
    { characterId: "bastian", userId: "lena", type: "cover" },
    { characterId: "atreju", userId: "ben", type: "primary" },
  ],
  scenes: [
    { id: "s3", label: "Sz. 3", characterIds: ["bastian", "atreju"] },
    { id: "s5", label: "Sz. 5", characterIds: ["bastian"] },
  ],
  departments: [{ id: "buehne", name: "Bühnenbau", memberIds: ["ben", "anna"] }],
};

const at = (time: string) => new Date(`2026-10-03T${time}:00Z`);

describe("scenesByPerson", () => {
  it("maps people to the selected scenes they appear in", () => {
    const result = scenesByPerson(["s3", "s5"], context);
    expect(result.get("max")).toEqual(["s3", "s5"]);
    expect(result.get("ben")).toEqual(["s3"]);
    expect(result.get("lena")).toEqual(["s3", "s5"]);
  });
});

describe("computePersonalWindows", () => {
  it("spans from the first to the last own scene", () => {
    const windows = computePersonalWindows(
      [
        { sceneId: "s3", startsAt: at("16:00"), endsAt: at("16:45") },
        { sceneId: "s5", startsAt: at("17:00"), endsAt: at("17:30") },
      ],
      context,
    );
    expect(windows.get("max")).toEqual({ start: at("16:00"), end: at("17:30") });
    expect(windows.get("ben")).toEqual({ start: at("16:00"), end: at("16:45") });
  });

  it("ignores scenes without times", () => {
    const windows = computePersonalWindows(
      [
        { sceneId: "s3", startsAt: null, endsAt: null },
        { sceneId: "s5", startsAt: at("17:00"), endsAt: at("17:30") },
      ],
      context,
    );
    expect(windows.has("ben")).toBe(false);
    expect(windows.get("max")).toEqual({ start: at("17:00"), end: at("17:30") });
  });

  it("adds timed department blocks, also in parallel to scenes", () => {
    const windows = computePersonalWindows(
      [{ sceneId: "s3", startsAt: at("16:00"), endsAt: at("16:45") }],
      context,
      [
        { departmentId: "buehne", startsAt: at("16:30"), endsAt: at("18:00") },
        { departmentId: "buehne", startsAt: null, endsAt: null },
      ],
    );
    expect(windows.get("ben")).toEqual({ start: at("16:00"), end: at("18:00") });
    expect(windows.get("anna")).toEqual({ start: at("16:30"), end: at("18:00") });
    expect(windows.get("max")).toEqual({ start: at("16:00"), end: at("16:45") });
  });
});
