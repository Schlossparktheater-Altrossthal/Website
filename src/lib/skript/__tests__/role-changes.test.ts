import { describe, expect, it } from "vitest";

import { detectRoleChanges } from "../role-changes";

describe("detectRoleChanges", () => {
  it("Umbenennung: Diener → Passepartout", () => {
    const changes = detectRoleChanges({
      unknown: new Map([["Passepartout", [["diener"], ["diener"], ["diener"], []]]]),
      vanished: new Set(["diener"]),
    });
    expect(changes).toEqual([
      { name: "Passepartout", kind: "rename", sources: [{ roleId: "diener", share: 1 }] },
    ]);
  });

  it("Zusammenlegung: Polizist 1 + 2 → Polizist", () => {
    const [change] = detectRoleChanges({
      unknown: new Map([["Polizist", [["p1"], ["p2"], ["p1"], ["p2"]]]]),
      vanished: new Set(["p1", "p2"]),
    });
    expect(change.kind).toBe("merge");
    expect(change.sources.map((s) => s.roleId).sort()).toEqual(["p1", "p2"]);
  });

  it("Aufteilung: Wache → Wache 1 + Wache 2", () => {
    const changes = detectRoleChanges({
      unknown: new Map([
        ["Wache 1", [["w"], ["w"]]],
        ["Wache 2", [["w"], ["w"], ["w"]]],
      ]),
      vanished: new Set(["w"]),
    });
    expect(changes.map((c) => c.kind)).toEqual(["split", "split"]);
  });

  it("noch vorhandene Rollen und Einzelfälle zählen nicht", () => {
    expect(
      detectRoleChanges({
        unknown: new Map([
          ["Neu", [["fogg"], ["fogg"], ["fogg"]]],
          ["Selten", [["x"]]],
        ]),
        vanished: new Set(["x"]),
      }),
    ).toEqual([]);
  });
});
