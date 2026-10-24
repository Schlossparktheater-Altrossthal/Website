import { describe, expect, it } from "vitest";

import { cleanSceneTitle, planAppearances, planScenes, prettyName } from "../takeover-plan";

describe("cleanSceneTitle / prettyName", () => {
  it("entfernt die Szenennummer", () => {
    expect(cleanSceneTitle("SZENE 3 – ATRÉJUS AUFTRAG")).toBe("ATRÉJUS AUFTRAG");
    expect(cleanSceneTitle("1. Szene: Im Reform Club")).toBe("Im Reform Club");
    expect(cleanSceneTitle("PROLOG")).toBe("PROLOG");
  });
  it("macht Großbuchstaben lesbar", () => {
    expect(prettyName("KINDLICHE KAISERIN")).toBe("Kindliche Kaiserin");
    expect(prettyName("Mr. Fogg")).toBe("Mr. Fogg");
  });
});

describe("planScenes", () => {
  const base = { hasContent: true, seconds: 300 };
  it("schlägt passende Stück-Szene über den Titel vor, Gliederung fällt weg", () => {
    const plan = planScenes({
      scriptScenes: [
        { ...base, sceneKey: "k0", title: "1. TEIL" },
        { ...base, sceneKey: "k1", title: "SZENE 1 – Im Club" },
      ],
      showScenes: [{ id: "s1", title: "Im Club", durationMinutes: null }],
      links: [],
    });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ status: "new", suggestionId: "s1", title: "Im Club" });
  });

  it("von Hand geänderte Felder sind nicht vorausgewählt (E-U3)", () => {
    const plan = planScenes({
      scriptScenes: [{ ...base, sceneKey: "k1", title: "Neuer Titel" }],
      showScenes: [{ id: "s1", title: "Eigener Titel", durationMinutes: 5 }],
      links: [
        { sceneKey: "k1", sceneId: "s1", synced: { title: "Alter Titel", durationMinutes: 5 } },
      ],
    });
    expect(plan[0].status).toBe("linked");
    const title = plan[0].fields.find((f) => f.field === "title")!;
    expect(title).toMatchObject({ handEdited: true, preselect: false, to: "Neuer Titel" });
    expect(plan[0].fields.find((f) => f.field === "durationMinutes")).toBeUndefined();
  });

  it("unverändert seit der letzten Übernahme → vorausgewählt", () => {
    const plan = planScenes({
      scriptScenes: [{ ...base, sceneKey: "k1", title: "Neu", seconds: 600 }],
      showScenes: [{ id: "s1", title: "Alt", durationMinutes: 5 }],
      links: [{ sceneKey: "k1", sceneId: "s1", synced: { title: "Alt", durationMinutes: 5 } }],
    });
    expect(plan[0].fields.every((f) => f.preselect)).toBe(true);
  });

  it("ignorierte Szenen bleiben ignoriert", () => {
    const plan = planScenes({
      scriptScenes: [{ ...base, sceneKey: "k1", title: "X" }],
      showScenes: [],
      links: [{ sceneKey: "k1", sceneId: null, synced: null }],
    });
    expect(plan[0].status).toBe("ignored");
  });
});

describe("planAppearances", () => {
  it("fügt hinzu, schlägt nur Skript-Auftritte zum Entfernen vor", () => {
    const { add, remove } = planAppearances({
      wanted: new Map([["s1", new Set(["a", "b"])]]),
      existing: [
        { sceneId: "s1", characterId: "a", source: "manual" },
        { sceneId: "s1", characterId: "c", source: "script" },
        { sceneId: "s1", characterId: "d", source: "manual" },
        { sceneId: "s2", characterId: "c", source: "script" },
      ],
      managed: new Set(["a", "b", "c", "d"]),
    });
    expect(add).toEqual([{ sceneId: "s1", characterId: "b" }]);
    expect(remove).toEqual([{ sceneId: "s1", characterId: "c" }]);
  });
});
