import { describe, expect, it } from "vitest";

import {
  buildCastingModel,
  bundleConflicts,
  isEnsembleRole,
  isPartHeading,
  minimumCast,
  suggestBundles,
} from "@/lib/skript/casting";
import { sceneShortLabel } from "@/lib/skript/export-options";
import type { ScriptStats } from "@/lib/skript/stats";

const scene = (
  id: string,
  roles: string[],
  mentioned: string[] = [],
): ScriptStats["scenes"][number] =>
  ({
    id,
    title: id,
    words: roles.length * 10,
    passages: roles.length,
    pages: null,
    duration: { seconds: 60, estimated: true },
    roles: roles.map((r) => ({ id: r, words: 10, passages: 1 })),
    mentionedRoleIds: mentioned,
    cues: {},
  }) as unknown as ScriptStats["scenes"][number];

function stats(scenes: ScriptStats["scenes"], names: Record<string, string>): ScriptStats {
  const roles = Object.entries(names).map(([id, name]) => {
    const sceneIds = scenes.filter((s) => s.roles.some((r) => r.id === id)).map((s) => s.id);
    return {
      id,
      name,
      words: sceneIds.length * 10,
      passages: sceneIds.length,
      share: id === "fogg" ? 0.4 : 0.01,
      longestPassage: 10,
      sceneIds,
    };
  });
  return {
    totalWords: 0,
    totalPassages: 0,
    duration: { seconds: 0, estimated: true },
    roles,
    scenes,
    cues: [],
    gaps: [],
  };
}

describe("casting", () => {
  it("erkennt Sammelrollen und Gliederung", () => {
    for (const name of [
      "Alle",
      "Alle anderen",
      "Beide Händler",
      "Der Chor der Händler",
      "Weitere Händler",
      "Demonstranten",
    ]) {
      expect(isEnsembleRole(name), name).toBe(true);
    }
    for (const name of ["Fogg", "Zugführer", "1. Matrose", "Alfred"]) {
      expect(isEnsembleRole(name), name).toBe(false);
    }
    expect(isPartHeading("1. TEIL")).toBe(true);
    expect(isPartHeading("2. Akt")).toBe(true);
    expect(isPartHeading("1. SZENE: BEI FOGG")).toBe(false);
  });

  it("kürzt Szenentitel eindeutig", () => {
    expect(sceneShortLabel("20.A SZENE: IM HAFEN", 0)).toBe("20A");
    expect(sceneShortLabel("17. B SZENE optional", 0)).toBe("17B");
    expect(sceneShortLabel("1. SZENE: BEI FOGG", 5)).toBe("1");
    expect(sceneShortLabel("PROLOG", 2)).toBe("Pr");
  });

  it("gruppiert, zählt genannte Rollen als anwesend und überspringt Teil-Überschriften", () => {
    const s = stats(
      [
        { ...scene("t1", []), title: "1. TEIL" },
        scene("a", ["fogg", "wirt"]),
        scene("b", ["fogg"], ["wirt"]),
        scene("c", ["fogg", "alle"]),
      ],
      { fogg: "Fogg", wirt: "Wirt", alle: "Alle" },
    );
    const model = buildCastingModel(s);
    expect(model.scenes.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(model.scenes[0].part).toBe("1. TEIL");
    const wirt = model.roles.find((r) => r.id === "wirt")!;
    expect([...wirt.presence]).toEqual([
      [0, "speaks"],
      [1, "mentioned"],
    ]);
    expect(model.roles.map((r) => r.tier)).toEqual(["main", "small", "ensemble"]);
  });

  it("legt kleine Rollen mit Umziehpuffer zusammen", () => {
    const s = stats(
      [
        scene("1", ["fogg", "a"]),
        scene("2", ["fogg", "b"]),
        scene("3", ["fogg", "c"]),
        scene("4", ["fogg", "d"]),
      ],
      { fogg: "Fogg", a: "A", b: "B", c: "C", d: "D" },
    );
    const model = buildCastingModel(s);
    expect(minimumCast(model)).toBe(2);
    // Ohne Puffer reicht eine Person für A–D.
    const tight = suggestBundles(model, 0);
    expect(tight).toHaveLength(2);
    // Mit einer Szene Puffer: A+C und B+D.
    const relaxed = suggestBundles(model, 1);
    expect(relaxed).toHaveLength(3);
    expect(relaxed.slice(1).map((b) => [...b.roleIds].sort())).toEqual(
      expect.arrayContaining([
        ["a", "c"],
        ["b", "d"],
      ]),
    );
    // Höchstens eine Rolle pro Person: jede kleine Rolle einzeln.
    expect(suggestBundles(model, 0, 1)).toHaveLength(5);
    expect(suggestBundles(model, 0, 2)).toHaveLength(3);
    expect(bundleConflicts(model, ["a", "b"], 1)).toEqual([{ a: "a", b: "b", distance: 1 }]);
    expect(bundleConflicts(model, ["a", "c"], 1)).toEqual([]);
  });
});
