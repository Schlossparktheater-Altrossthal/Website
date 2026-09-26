import { describe, expect, it } from "vitest";

import type { AudienceContext } from "@/lib/calendar/audience";
import { buildDeclineMessage, findSceneImpacts } from "@/lib/calendar/decline-message";

const context: AudienceContext = {
  hasProduction: true,
  members: [
    { id: "max", name: "Max" },
    { id: "lena", name: "Lena" },
    { id: "tom", name: "Tom" },
  ],
  characters: [
    { id: "bastian", name: "Bastian" },
    { id: "atreju", name: "Atréju" },
  ],
  castings: [
    { characterId: "bastian", userId: "max", type: "primary" },
    { characterId: "bastian", userId: "lena", type: "alternate" },
    { characterId: "bastian", userId: "tom", type: "cover" },
    { characterId: "atreju", userId: "tom", type: "primary" },
  ],
  scenes: [
    { id: "s3", label: "Sz. 3", characterIds: ["bastian", "atreju"] },
    { id: "s5", label: "Sz. 5", characterIds: ["atreju"] },
  ],
  departments: [],
};

describe("findSceneImpacts", () => {
  it("lists affected scenes with available second casts", () => {
    const impacts = findSceneImpacts({
      userId: "max",
      sceneIds: ["s3", "s5"],
      context,
      availability: { tom: "blocked" },
      declinedIds: new Set(),
    });
    expect(impacts).toEqual([{ scene: "Sz. 3", character: "Bastian", available: ["Lena"] }]);
  });

  it("ignores roles the person only covers", () => {
    const impacts = findSceneImpacts({
      userId: "lena",
      sceneIds: ["s3"],
      context,
      availability: {},
      declinedIds: new Set(),
    });
    expect(impacts).toEqual([]);
  });

  it("skips second casts who declined as well", () => {
    const impacts = findSceneImpacts({
      userId: "max",
      sceneIds: ["s3"],
      context,
      availability: {},
      declinedIds: new Set(["lena"]),
    });
    expect(impacts[0]?.available).toEqual(["Tom"]);
  });
});

describe("buildDeclineMessage", () => {
  it("highlights short notice and names the missing role", () => {
    const message = buildDeclineMessage({
      personName: "Max",
      eventTitle: "Szenenprobe",
      when: "Sa., 03.10., 18:00 Uhr",
      reason: "krank",
      shortNotice: true,
      impacts: [{ scene: "Sz. 3", character: "Bastian", available: [] }],
    });
    expect(message.title).toBe("Kurzfristige Absage: Max – Szenenprobe");
    expect(message.body).toContain("Grund: krank");
    expect(message.body).toContain(
      "Sz. 3 ist unvollständig – Bastian fehlt (keine Zweitbesetzung verfügbar).",
    );
  });
});
