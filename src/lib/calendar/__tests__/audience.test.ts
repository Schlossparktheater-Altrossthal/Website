import { describe, expect, it } from "vitest";

import {
  computeAudienceDrift,
  describeAudienceRule,
  resolveAudience,
  type AudienceContext,
} from "@/lib/calendar/audience";

const context: AudienceContext = {
  hasProduction: true,
  members: [
    { id: "max", name: "Max" },
    { id: "lena", name: "Lena" },
    { id: "ben", name: "Ben" },
    { id: "tom", name: "Tom" },
    { id: "anna", name: "Anna" },
  ],
  characters: [
    { id: "bastian", name: "Bastian" },
    { id: "atreju", name: "Atréju" },
  ],
  castings: [
    { characterId: "bastian", userId: "max", type: "primary" },
    { characterId: "bastian", userId: "lena", type: "alternate" },
    { characterId: "atreju", userId: "ben", type: "primary" },
  ],
  scenes: [
    { id: "s3", label: "Sz. 3", characterIds: ["bastian", "atreju"] },
    { id: "s5", label: "Sz. 5", characterIds: ["bastian"] },
  ],
  departments: [{ id: "tech", name: "Technik", memberIds: ["tom", "max"] }],
};

describe("resolveAudience", () => {
  it("groups scenes per role and adds second casts as optional", () => {
    const result = resolveAudience(
      [
        { type: "SCENE", targetId: "s3", level: "REQUIRED" },
        { type: "SCENE", targetId: "s5", level: "REQUIRED" },
      ],
      [],
      context,
    );
    const max = result.find((entry) => entry.userId === "max");
    const lena = result.find((entry) => entry.userId === "lena");
    expect(max).toMatchObject({ level: "REQUIRED", reasons: ["Bastian (Sz. 3, Sz. 5)"] });
    expect(lena).toMatchObject({
      level: "OPTIONAL",
      reasons: ["Zweitbesetzung Bastian (Sz. 3, Sz. 5)"],
    });
    expect(result.map((entry) => entry.userId).sort()).toEqual(["ben", "lena", "max"]);
  });

  it("keeps the strongest level and all reasons", () => {
    const result = resolveAudience(
      [
        { type: "DEPARTMENT", targetId: "tech", level: "OPTIONAL" },
        { type: "CHARACTER", targetId: "bastian", level: "REQUIRED" },
      ],
      [],
      context,
    );
    expect(result.find((entry) => entry.userId === "max")).toMatchObject({
      level: "REQUIRED",
      reasons: ["Gewerk Technik", "Bastian"],
    });
  });

  it("applies manual exclusions, inclusions and level changes", () => {
    const result = resolveAudience(
      [{ type: "CHARACTER", targetId: "bastian", level: "REQUIRED" }],
      [
        { userId: "lena", override: "EXCLUDED", level: null },
        { userId: "anna", override: "INCLUDED", level: "OPTIONAL" },
        { userId: "max", override: null, level: "OPTIONAL" },
      ],
      context,
    );
    expect(result.find((entry) => entry.userId === "lena")?.excluded).toBe(true);
    expect(result.find((entry) => entry.userId === "anna")).toMatchObject({
      level: "OPTIONAL",
      reasons: ["Von Hand hinzugefügt"],
      excluded: false,
    });
    expect(result.find((entry) => entry.userId === "max")).toMatchObject({
      level: "OPTIONAL",
      ruleLevel: "REQUIRED",
    });
  });

  it("ignores exclusions of people no rule selects", () => {
    const result = resolveAudience(
      [],
      [{ userId: "tom", override: "EXCLUDED", level: null }],
      context,
    );
    expect(result).toEqual([]);
  });
});

describe("computeAudienceDrift", () => {
  it("lists added, removed and changed participants", () => {
    const resolved = resolveAudience(
      [{ type: "CHARACTER", targetId: "bastian", level: "REQUIRED" }],
      [],
      context,
    );
    const drift = computeAudienceDrift(
      [
        { userId: "max", name: "Max", level: "OPTIONAL" },
        { userId: "ben", name: "Ben", level: "REQUIRED" },
      ],
      resolved,
    );
    expect(drift.added.map((entry) => entry.userId)).toEqual(["lena"]);
    expect(drift.removed.map((entry) => entry.userId)).toEqual(["ben"]);
    expect(drift.levelChanged.map((entry) => entry.userId)).toEqual(["max"]);
  });
});

describe("describeAudienceRule", () => {
  it("names rules for chips", () => {
    expect(
      describeAudienceRule({ type: "SCENE", targetId: "s3", level: "REQUIRED" }, context),
    ).toBe("Rollen aus Sz. 3");
    expect(
      describeAudienceRule({ type: "PRODUCTION_ALL", targetId: null, level: "REQUIRED" }, context),
    ).toBe("Ganze Produktion");
  });
});
