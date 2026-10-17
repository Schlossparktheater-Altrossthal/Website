import { describe, expect, it } from "vitest";

import {
  BUILT_IN_VIEWS,
  DEFAULT_SCRIPT_VIEW,
  matchesView,
  pickView,
  sanitizeViewPatch,
  scriptViewSchema,
} from "@/lib/skript/view-options";

describe("Skript-Ansichten", () => {
  it("fertige Ansichten sind gültig", () => {
    for (const view of BUILT_IN_VIEWS) {
      expect(scriptViewSchema.parse({ ...DEFAULT_SCRIPT_VIEW, ...view.view })).toBeTruthy();
      expect(sanitizeViewPatch(view.view)).toEqual(view.view);
    }
  });

  it("liest gespeicherte Stände robust: ungültige und fremde Felder fallen weg", () => {
    expect(
      sanitizeViewPatch({
        fontSize: 9,
        directions: "dim",
        roleIds: ["a"],
        keepAwake: false,
        hiddenCues: ["ton", "quatsch"],
        sceneHeader: { mode: "card" },
      }),
    ).toEqual({
      directions: "dim",
      sceneHeader: { mode: "card", items: ["roles", "mine", "duration", "cues"], onlyMine: false },
    });
  });

  it("pickView lässt Rollen und Geräteeinstellungen weg", () => {
    const view = pickView({ ...DEFAULT_SCRIPT_VIEW, roleIds: ["a"], keepAwake: true });
    expect(view).toEqual(DEFAULT_SCRIPT_VIEW);
  });

  it("erkennt die aktive Ansicht", () => {
    const regie = BUILT_IN_VIEWS.find((v) => v.id === "regie");
    const current = { ...DEFAULT_SCRIPT_VIEW, ...regie?.view };
    expect(matchesView(current, regie?.view ?? {})).toBe(true);
    expect(matchesView({ ...current, fontSize: 2 }, { fontSize: 1 })).toBe(false);
  });
});
