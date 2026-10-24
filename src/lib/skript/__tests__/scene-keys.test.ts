import { describe, expect, it } from "vitest";

import { inheritSceneKeys } from "../scene-keys";

describe("inheritSceneKeys", () => {
  const previous = [
    { sceneKey: "K1", titleKey: "1 szene", lineageIds: ["a", "b", "c"] },
    { sceneKey: "K2", titleKey: "20a szene", lineageIds: ["d", "e"] },
  ];

  it("umnummerierte Szene behält ihren Schlüssel über die Absätze", () => {
    const keys = inheritSceneKeys({
      previous,
      scenes: [
        { id: "s1", titleKey: "1 szene", lineageIds: ["a", "b", "x"] },
        { id: "s17", titleKey: "17 szene", lineageIds: ["d", "e", "y"] },
      ],
    });
    expect(keys.get("s1")).toBe("K1");
    expect(keys.get("s17")).toBe("K2");
  });

  it("geteilte Szene: Mehrheit gewinnt, der Rest ist neu", () => {
    const keys = inheritSceneKeys({
      previous,
      scenes: [
        { id: "x1", titleKey: "neu", lineageIds: ["a", "b"] },
        { id: "x2", titleKey: "neu2", lineageIds: ["c"] },
      ],
    });
    expect(keys.get("x1")).toBe("K1");
    expect(keys.has("x2")).toBe(false);
  });

  it("ohne Absatz-Treffer zählt der Titel", () => {
    const keys = inheritSceneKeys({
      previous,
      scenes: [{ id: "t", titleKey: "20a szene", lineageIds: ["z"] }],
    });
    expect(keys.get("t")).toBe("K2");
  });
});
