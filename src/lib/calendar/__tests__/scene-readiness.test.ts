import { describe, expect, it } from "vitest";

import {
  computeSceneReadiness,
  countReadiness,
  describeReadiness,
} from "@/lib/calendar/scene-readiness";

const context = {
  members: [
    { id: "kat", name: "Katharina Wolf" },
    { id: "emma", name: "Emma Braun" },
    { id: "clara", name: "Clara Neumann" },
    { id: "max", name: "Max Kaiser" },
  ],
  characters: [
    { id: "titania", name: "Titania" },
    { id: "helena", name: "Helena" },
    { id: "puck", name: "Puck" },
    { id: "mond", name: "Mond" },
  ],
  castings: [
    { characterId: "titania", userId: "kat", type: "primary" as const },
    { characterId: "helena", userId: "clara", type: "primary" as const },
    { characterId: "helena", userId: "emma", type: "alternate" as const },
    { characterId: "puck", userId: "max", type: "primary" as const },
  ],
  scenes: [
    { id: "s1", label: "Sz. 1", characterIds: ["puck"] },
    { id: "s2", label: "Sz. 2", characterIds: ["helena", "puck"] },
    { id: "s3", label: "Sz. 3", characterIds: ["titania", "helena"] },
    { id: "s4", label: "Sz. 4", characterIds: ["mond", "puck"] },
  ],
};

describe("computeSceneReadiness", () => {
  it("marks scenes as ready when everyone is free", () => {
    const result = computeSceneReadiness(context, {});
    expect(result.map((entry) => entry.status)).toEqual(["ready", "ready", "ready", "ready"]);
    expect(result[3]?.uncast).toEqual(["Mond"]);
  });

  it("uses the alternate and reports missing roles", () => {
    const result = computeSceneReadiness(context, {
      clara: { kind: "blocked", reason: "Urlaub" },
      kat: { kind: "declined" },
    });
    expect(result[1]?.status).toBe("alternate");
    expect(result[1]?.issues[0]?.substitute?.name).toBe("Emma Braun");
    expect(result[2]?.status).toBe("missing");
    expect(describeReadiness(result[2]!)).toBe(
      "Titania fehlt (Katharina: abgesagt) · Helena: Emma statt Clara: Urlaub",
    );
    expect(countReadiness(result)).toEqual({ ready: 2, alternate: 1, limited: 0, missing: 1 });
  });

  it("treats limited primaries as limited", () => {
    const result = computeSceneReadiness(context, { max: { kind: "limited" } });
    expect(result[0]?.status).toBe("limited");
  });
});
