import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  findMatchingWishWeight,
  listCrewWishOptions,
  loadTemplateWishTitles,
  templateMatchCodes,
} from "../crew-options";

const template = (
  slug: string,
  name: string,
  preferenceCodes: string[],
  extra: Partial<{ onboardingVisible: boolean; onboardingDescription: string | null }> = {},
) => ({
  id: `tpl_${slug}`,
  slug,
  name,
  description: `${name} (Beschreibung)`,
  color: null,
  preferenceCodes,
  onboardingVisible: true,
  onboardingDescription: null,
  ...extra,
});

// Wie der Bestand: crew_tech gehört zu Licht und Ton, Schauspiel/Technik ohne Wunsch.
const templates = [
  template("schauspiel", "Schauspiel", [], { onboardingVisible: false }),
  template("buehnenbild", "Bühnenbild", ["crew_stage"]),
  template("technik", "Technik", [], { onboardingVisible: false }),
  template("kostuem", "Kostüm", ["crew_costume"], { onboardingDescription: "Nähen & Fundus" }),
  template("licht", "Licht", ["crew_tech"]),
  template("ton", "Ton", ["crew_tech", "crew_music"]),
  template("requisite", "Requisite", ["crew_props"]),
];

function fakeDb(departmentSlugs: string[] | null) {
  return {
    departmentTemplate: { findMany: vi.fn(async () => templates) },
    department: {
      findMany: vi.fn(async () =>
        (departmentSlugs ?? []).map((slug) => ({ templateId: `tpl_${slug}` })),
      ),
    },
  } as never;
}

describe("listCrewWishOptions", () => {
  it("bietet die Gewerke der Produktion an und behält eindeutige Alt-Codes", async () => {
    const options = await listCrewWishOptions("show", fakeDb(["kostuem", "licht", "ton"]));
    expect(options.slice(0, 3).map((option) => [option.code, option.title])).toEqual([
      ["crew_costume", "Kostüm"],
      ["tpl:licht", "Licht"],
      ["tpl:ton", "Ton"],
    ]);
    expect(options[0].description).toBe("Nähen & Fundus");
    expect(options[1].matchCodes).toEqual(["tpl:licht", "crew_tech"]);
  });

  it("ergänzt feste Wünsche, die keine Blaupause der Produktion abdeckt", async () => {
    const options = await listCrewWishOptions("show", fakeDb(["kostuem", "licht", "ton"]));
    const fixed = options.filter((option) => option.templateId === null).map((o) => o.code);
    expect(fixed).toContain("crew_direction");
    expect(fixed).toContain("crew_stage");
    expect(fixed).not.toContain("crew_tech");
    expect(fixed).not.toContain("crew_music");
    expect(fixed).not.toContain("crew_costume");
  });

  it("zeigt ausgeblendete Blaupausen nicht und deckt ihre Codes trotzdem ab", async () => {
    const options = await listCrewWishOptions("show", fakeDb(["schauspiel", "technik", "kostuem"]));
    expect(options.some((option) => option.title === "Schauspiel")).toBe(false);
    expect(options.some((option) => option.title === "Technik")).toBe(false);
  });

  it("nimmt ohne Gewerke alle sichtbaren Blaupausen", async () => {
    const options = await listCrewWishOptions(null, fakeDb(null));
    expect(options.filter((option) => option.templateId).map((option) => option.code)).toEqual([
      "crew_stage",
      "crew_costume",
      "tpl:licht",
      "tpl:ton",
      "crew_props",
    ]);
  });
});

describe("Hilfsfunktionen", () => {
  it("ordnet Alt-Codes und tpl-Codes einer Blaupause zu", () => {
    expect(templateMatchCodes({ slug: "ton", preferenceCodes: ["crew_tech"] })).toEqual([
      "crew_tech",
      "tpl:ton",
    ]);
  });

  it("übernimmt das höchste passende Gewicht", () => {
    const weights = new Map([
      ["crew_tech", 40],
      ["crew_music", 80],
    ]);
    expect(
      findMatchingWishWeight({ matchCodes: ["tpl:ton", "crew_tech", "crew_music"] }, weights),
    ).toBe(80);
    expect(findMatchingWishWeight({ matchCodes: ["tpl:licht"] }, weights)).toBeNull();
  });

  it("liefert Titel für tpl- und eindeutige Alt-Codes", async () => {
    const titles = await loadTemplateWishTitles(fakeDb(null));
    expect(titles.get("tpl:ton")).toBe("Ton");
    expect(titles.get("crew_costume")).toBe("Kostüm");
    expect(titles.has("crew_tech")).toBe(false);
  });
});
