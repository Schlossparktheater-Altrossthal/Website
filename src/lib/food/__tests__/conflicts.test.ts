import { describe, expect, it } from "vitest";

import { checkFood, type PersonDietProfile, type PersonRestriction } from "@/lib/food/conflicts";

import { fixtureIndex } from "./fixture";

const index = fixtureIndex();

function person(
  restrictions: Partial<PersonRestriction>[] = [],
  extra: Partial<PersonDietProfile> = {},
): PersonDietProfile {
  return {
    restrictions: restrictions.map((restriction) => ({
      label: restriction.label ?? restriction.taxonCode ?? "?",
      taxonCode: restriction.taxonCode ?? null,
      level: restriction.level ?? "SEVERE",
      tracesOk: restriction.tracesOk ?? null,
    })),
    style: null,
    ...extra,
  };
}

const food = (codes: string[], traces: string[] = []) => ({
  codes,
  traces,
  status: "MATCHED" as const,
});

describe("Taxonomie-Hülle", () => {
  it("vererbt Allergene über den Baum", () => {
    expect(index.closure("en:hazelnut").has("en:nuts")).toBe(true);
    expect(index.closure("en:wheat-flour").has("en:gluten")).toBe(true);
  });

  it("ergänzt Hafer um Gluten (LMIV), obwohl OFF es nicht führt", () => {
    expect(index.closure("en:oat").has("en:gluten")).toBe(true);
  });

  it("Milchprodukte enthalten Laktose, laktosefreie nicht", () => {
    expect(index.closure("en:butter").has("en:lactose")).toBe(true);
    expect(index.closure("en:lactose-free-cream").has("en:lactose")).toBe(false);
    expect(index.closure("en:lactose-free-cream").has("en:milk")).toBe(true);
  });

  it("Säugetierfleisch löst Alpha-Gal aus, Geflügel nicht", () => {
    expect(index.closure("en:beef").has("x:alpha-gal")).toBe(true);
    expect(index.closure("en:chicken").has("x:alpha-gal")).toBe(false);
  });
});

describe("Allergien und Unverträglichkeiten", () => {
  it("Haselnuss-Allergie: Haselnuss ja, Mandel nein", () => {
    const hazel = person([{ taxonCode: "en:hazelnut" }]);
    expect(checkFood(index, hazel, food(["en:hazelnut"])).verdict).toBe("conflict");
    expect(checkFood(index, hazel, food(["en:almond"])).verdict).toBe("ok");
  });

  it("Schalenfrüchte-Allergie trifft jede Baumnuss, aber nicht Erdnuss", () => {
    const nuts = person([{ taxonCode: "en:nuts" }]);
    expect(checkFood(index, nuts, food(["en:almond"])).verdict).toBe("conflict");
    expect(checkFood(index, nuts, food(["en:peanut"])).verdict).toBe("ok");
  });

  it("Laktoseintoleranz: Butter ja, laktosefreie Sahne nein; Milcheiweißallergie beide", () => {
    const lactose = person([{ taxonCode: "en:lactose", level: "MILD" }]);
    expect(checkFood(index, lactose, food(["en:butter"])).verdict).toBe("conflict");
    expect(checkFood(index, lactose, food(["en:lactose-free-cream"])).verdict).toBe("ok");
    const milk = person([{ taxonCode: "en:milk" }]);
    expect(checkFood(index, milk, food(["en:lactose-free-cream"])).verdict).toBe("conflict");
  });

  it("Spuren: ohne Angabe ein Konflikt, mit „Spuren ok“ nicht", () => {
    const strict = person([{ taxonCode: "en:nuts" }]);
    const relaxed = person([{ taxonCode: "en:nuts", tracesOk: true }]);
    const chocolate = food(["en:chocolate"], ["en:hazelnut"]);
    expect(checkFood(index, strict, chocolate).reasons[0]?.type).toBe("traces");
    expect(checkFood(index, relaxed, chocolate).verdict).toBe("ok");
  });

  it("ungeklärte Angabe ist nie ok", () => {
    const unknown = person([{ label: "Drachenfrucht-Kerne", taxonCode: null }]);
    expect(checkFood(index, unknown, food(["en:rice"])).verdict).toBe("check");
  });

  it("nicht automatisch prüfbare Auslöser (FODMAP) melden „manuell prüfen“", () => {
    const fodmap = person([{ taxonCode: "x:fodmap", level: "MILD" }]);
    expect(checkFood(index, fodmap, food(["en:rice"])).verdict).toBe("check");
  });

  it("Latex/Medikamente spielen für Essen keine Rolle", () => {
    const latex = person([{ taxonCode: "x:latex" }]);
    expect(checkFood(index, latex, food(["en:rice"])).verdict).toBe("ok");
  });

  it("unvollständig zugeordnete Lebensmittel sind für Betroffene „prüfen“", () => {
    const nuts = person([{ taxonCode: "en:nuts" }]);
    expect(checkFood(index, nuts, { codes: ["en:rice"], status: "PARTIAL" }).verdict).toBe("check");
    expect(checkFood(index, person(), { codes: ["en:rice"], status: "PARTIAL" }).verdict).toBe(
      "ok",
    );
  });
});

describe("Ernährungsformen", () => {
  const style = (value: PersonDietProfile["style"], extra: Partial<PersonDietProfile> = {}) =>
    person([], { style: value, ...extra });

  it("vegan: Butter, Ei, Honig-freie Pflanzen", () => {
    expect(checkFood(index, style("vegan"), food(["en:butter"])).verdict).toBe("conflict");
    expect(checkFood(index, style("vegan"), food(["en:egg"])).verdict).toBe("conflict");
    expect(checkFood(index, style("vegan"), food(["en:rice", "en:tomato"])).verdict).toBe("ok");
  });

  it("vegetarisch: Schwein und Lachs nein, Ei ja; Unterform ohne Ei", () => {
    expect(checkFood(index, style("vegetarian"), food(["en:pork"])).verdict).toBe("conflict");
    expect(checkFood(index, style("vegetarian"), food(["en:salmon"])).verdict).toBe("conflict");
    expect(checkFood(index, style("vegetarian"), food(["en:egg"])).verdict).toBe("ok");
    expect(
      checkFood(index, style("vegetarian", { variant: "lacto" }), food(["en:egg"])).verdict,
    ).toBe("conflict");
  });

  it("pescetarisch: Lachs ja, Huhn nein", () => {
    expect(checkFood(index, style("pescetarian"), food(["en:salmon"])).verdict).toBe("ok");
    expect(checkFood(index, style("pescetarian"), food(["en:chicken"])).verdict).toBe("conflict");
  });

  it("halal: Schwein und Wein nein, Rind prüfen", () => {
    expect(checkFood(index, style("halal"), food(["en:pork"])).verdict).toBe("conflict");
    expect(checkFood(index, style("halal"), food(["en:wine"])).verdict).toBe("conflict");
    expect(checkFood(index, style("halal"), food(["en:beef"])).verdict).toBe("check");
  });

  it("koscher: Fleisch mit Milch zusammen ist ein Konflikt", () => {
    expect(checkFood(index, style("kosher"), food(["en:beef", "en:butter"])).verdict).toBe(
      "conflict",
    );
  });

  it("situationsabhängig wird zu „prüfen“ statt Konflikt", () => {
    expect(
      checkFood(index, style("vegetarian", { strictness: "situational" }), food(["en:pork"]))
        .verdict,
    ).toBe("check");
  });
});

describe("Textzuordnung", () => {
  it("findet Namen, Synonyme und Pluralformen", () => {
    expect(index.matchExact("Haselnüsse")?.code).toBe("en:hazelnut");
    expect(index.matchExact("tomaten")?.code).toBe("en:tomato");
    expect(index.matchExact("Milchzucker")?.code).toBe("en:lactose");
  });

  it("zerlegt Zusammensetzungen und Wortfolgen", () => {
    expect(index.matchText("Haselnusskrokant").map((match) => match.code)).toContain("en:hazelnut");
    expect(index.matchText("Rind und Schwein, gemischt").map((match) => match.code)).toEqual(
      expect.arrayContaining(["en:beef", "en:pork"]),
    );
  });

  it("bestätigte Aliase haben Vorrang", () => {
    const withAlias = fixtureIndex([["Nüsse", "en:nuts"]]);
    expect(withAlias.matchExact("nüsse")?.code).toBe("en:nuts");
  });

  it("Abneigungen werden nur als Hinweis gemeldet", () => {
    const result = checkFood(
      index,
      person([], { aversions: [{ label: "Tomaten" }] }),
      food(["en:tomato"]),
    );
    expect(result.verdict).toBe("ok");
    expect(result.reasons).toEqual([{ type: "aversion", label: "Tomaten" }]);
  });
});

describe("Rezepte aus mehreren Zutaten", () => {
  it("„laktosefrei“ gilt nur für die eigene Zutat", () => {
    const lactose = person([{ taxonCode: "en:lactose", level: "MILD" }]);
    const onlyFree = {
      codes: [],
      components: [["en:lactose-free-cream"]],
      status: "MATCHED" as const,
    };
    const withButter = {
      codes: [],
      components: [["en:lactose-free-cream"], ["en:butter"]],
      status: "MATCHED" as const,
    };
    expect(checkFood(index, lactose, onlyFree).verdict).toBe("ok");
    expect(checkFood(index, lactose, withButter).verdict).toBe("conflict");
  });

  it("Zusammensetzungen liefern Wortanfang und -ende", () => {
    expect(index.matchText("Schokoladentomate").map((match) => match.code)).toEqual(
      expect.arrayContaining(["en:chocolate", "en:tomato"]),
    );
  });
});
