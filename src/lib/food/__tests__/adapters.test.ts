import { describe, expect, it, vi } from "vitest";

import { cleanBlsName, mapBlsFood } from "@/lib/food/bls/map";
import { blsValueColumnCode } from "@/lib/food/bls/parse";
import { checkFood } from "@/lib/food/conflicts";
import { mapOffProduct, type OffProduct } from "@/lib/food/off/product";
import { computeRecipe, type RecipeIngredientInput } from "@/lib/food/recipes/compute";
import { parseIngredientLine } from "@/lib/food/recipes/ingredient-line";
import { extractJsonLd, isoDurationMinutes, parseRecipeJsonLd } from "@/lib/food/recipes/json-ld";
import { isBlockedAddress } from "@/lib/food/recipes/safe-fetch";
import { pickFoodItem } from "@/lib/food/recipes/service";
import { linkRestrictionText, stripQualifiers } from "@/lib/food/restriction-link";
import { parseOffSynonyms } from "@/lib/food/taxonomy/off-parse";

import { fixtureIndex } from "./fixture";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const index = fixtureIndex();

describe("OFF-Taxonomie-Quelltext", () => {
  it("liest Synonyme je Eintrag, ignoriert Eigenschaften und Kommentare", () => {
    const source = [
      "# Kommentar",
      "synonyms:en: colour, color",
      "",
      "< en:tree-nut",
      "en: Hazelnut, hazelnuts",
      "de: Haselnuss, Haselnüsse",
      "allergens:en: en:nuts",
      "",
    ].join("\n");
    expect(parseOffSynonyms(source).get("en:hazelnut")).toEqual({
      de: ["Haselnuss", "Haselnüsse"],
      en: ["Hazelnut", "hazelnuts"],
    });
  });
});

describe("BLS-Adapter", () => {
  it("erkennt Nährstoffspalten", () => {
    expect(blsValueColumnCode("PROT625 Protein (Nx6,25) [g/100g]")).toBe("PROT625");
    expect(blsValueColumnCode("PROT625 Datenherkunft")).toBeNull();
  });

  it("entfernt Zubereitung und Fettangaben aus dem Namen", () => {
    expect(cleanBlsName("Rind Brust, gekocht ohne Fett (Pfanne)")).toBe("rind brust");
    expect(cleanBlsName("Vollmilch 3,5 % Fett, laktosefrei")).toBe("vollmilch laktosefrei");
  });

  it("ordnet Grundlebensmittel sicher zu und nimmt Gruppenannahmen hinzu", () => {
    const hazelnut = mapBlsFood(
      { code: "H130100", nameDe: "Haselnuss", nameEn: "Hazelnut", nutrients: {} },
      index,
    );
    expect(hazelnut).toMatchObject({ matchStatus: "MATCHED", taxonCodes: ["en:hazelnut"] });

    const bread = mapBlsFood(
      { code: "B100000", nameDe: "Weizenbrot", nameEn: null, nutrients: {} },
      index,
    );
    expect(index.closureOf(bread.taxonCodes).has("en:gluten")).toBe(true);
    expect(bread.matchStatus).toBe("PARTIAL");
  });

  it("Mischungen mit „/“ liefern alle Bestandteile", () => {
    const mixed = mapBlsFood(
      {
        code: "U050100",
        nameDe: "Rind/Schwein, Hackfleisch gemischt, roh",
        nameEn: null,
        nutrients: {},
      },
      index,
    );
    expect(mixed.taxonCodes).toEqual(expect.arrayContaining(["en:beef", "en:pork"]));
  });

  it("gemessene Laktose ergibt Milch, „laktosefrei“ hebt sie auf", () => {
    const pudding = mapBlsFood(
      { code: "Y860000", nameDe: "Pudding", nameEn: null, nutrients: { LACS: 4.2 } },
      index,
    );
    expect(pudding.taxonCodes).toEqual(expect.arrayContaining(["en:lactose", "en:milk"]));

    const milk = mapBlsFood(
      {
        code: "M114300",
        nameDe: "Vollmilch 3,5 % Fett, laktosefrei",
        nameEn: null,
        nutrients: { LACS: 0.05 },
      },
      index,
    );
    const lactose = {
      restrictions: [
        { label: "Laktose", taxonCode: "en:lactose", level: "MILD" as const, tracesOk: null },
      ],
      style: null,
    };
    expect(
      checkFood(index, lactose, { codes: milk.taxonCodes, status: milk.matchStatus }).verdict,
    ).not.toBe("conflict");
  });

  it("eifreie Teigwaren ohne Ei, Eier aus Gruppe E1 ohne Gluten", () => {
    const pasta = mapBlsFood(
      { code: "E401000", nameDe: "Teigwaren eifrei, roh", nameEn: null, nutrients: {} },
      index,
    );
    expect(pasta.taxonCodes).toContain("en:gluten");
    expect(pasta.taxonCodes).not.toContain("en:egg");
    const egg = mapBlsFood(
      { code: "E111100", nameDe: "Hühnerei roh", nameEn: null, nutrients: {} },
      index,
    );
    expect(egg.taxonCodes).not.toContain("en:gluten");
  });
});

describe("OFF-Produkt-Adapter", () => {
  const product: OffProduct = {
    code: "4000417025005",
    product_name: "Chocolate",
    product_name_de: "Schokolade Mandel",
    brands: "Beispiel",
    allergens_tags: ["en:nuts"],
    traces_tags: ["en:peanuts"],
    ingredients_tags: ["en:sugar", "en:almond", "en:unbekannt"],
    labels_tags: ["en:no-gluten"],
    nutriments: { "energy-kcal_100g": 496, sodium_100g: 0.02, proteins_100g: 6 },
  };

  it("übernimmt bekannte Taxa, Spuren, Nährwerte (BLS-Einheiten) und Labels", () => {
    const mapped = mapOffProduct(product, index);
    expect(mapped.taxonCodes).toEqual(["en:almond", "en:nuts", "en:sugar", "x:label-gluten-free"]);
    expect(mapped.tracesCodes).toEqual(["en:peanuts"]);
    expect(mapped.nutrients).toEqual({ ENERCC: 496, NA: 20, PROT625: 6 });
    expect(mapped.matchStatus).toBe("MATCHED");
    expect(mapped.nameDe).toBe("Schokolade Mandel (Beispiel)");
  });
});

describe("Zutatenzeilen", () => {
  it.each([
    ["200 g Mehl (Type 405)", { amount: 200, unit: "g", name: "Mehl", note: "Type 405" }],
    ["200g Zucker", { amount: 200, unit: "g", name: "Zucker" }],
    ["1 ½ EL Olivenöl", { amount: 1.5, unit: "el", name: "Olivenöl" }],
    ["1/2 TL Salz", { amount: 0.5, unit: "tl", name: "Salz" }],
    ["2-3 Eier, Größe M", { amount: 2, amountMax: 3, unit: null, name: "Eier", note: "Größe M" }],
    ["Pfeffer, nach Belieben", { amount: null, unit: null, name: "Pfeffer", optional: true }],
    ["3 Zehen Knoblauch", { amount: 3, unit: "zehe", name: "Knoblauch" }],
    ["1 Pck. Vanillezucker", { amount: 1, unit: "packung", name: "Vanillezucker" }],
  ])("%s", (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject(expected);
  });
});

describe("Rezept aus JSON-LD", () => {
  const html = `<html><head>
    <script type="application/ld+json">{ kaputt }</script>
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Seite" },
        {
          "@type": ["Recipe"],
          name: "Linsen&shy;suppe &amp; Brot",
          recipeYield: ["4 Portionen"],
          recipeIngredient: ["200 g Linsen", "1 Zwiebel"],
          recipeInstructions: [
            {
              "@type": "HowToSection",
              itemListElement: [{ "@type": "HowToStep", text: "Linsen <b>kochen</b>." }],
            },
          ],
          prepTime: "PT15M",
          cookTime: "PT1H",
          keywords: "Suppe, vegan",
          publisher: { name: "Beispielseite" },
        },
      ],
    })}</script></head></html>`;

  it("findet das Rezept auch in @graph und überspringt defekte Blöcke", () => {
    const recipe = parseRecipeJsonLd(extractJsonLd(html), "https://example.org/linsen");
    expect(recipe).toMatchObject({
      servings: 4,
      ingredientLines: ["200 g Linsen", "1 Zwiebel"],
      steps: ["Linsen kochen ."],
      prepMinutes: 15,
      cookMinutes: 60,
      tags: ["Suppe", "vegan"],
      sourceName: "Beispielseite",
    });
    expect(recipe?.title).toContain("& Brot");
  });

  it("liest ISO-Dauern", () => {
    expect(isoDurationMinutes("PT1H30M")).toBe(90);
    expect(isoDurationMinutes("P1DT2H")).toBe(1560);
    expect(isoDurationMinutes("unsinn")).toBeNull();
  });
});

describe("Rezept-Auswertung", () => {
  const line = (overrides: Partial<RecipeIngredientInput>): RecipeIngredientInput => ({
    name: "x",
    amount: null,
    unit: null,
    taxonCodes: [],
    status: "MATCHED",
    foodItem: null,
    ...overrides,
  });

  it("berechnet Allergene, Ernährungsformen und Nährwerte je Portion", () => {
    const computed = computeRecipe(index, {
      servings: 2,
      ingredients: [
        line({
          name: "Weizenmehl",
          amount: 200,
          unit: "g",
          foodItem: {
            nutrients: { ENERCC: 350, PROT625: 10 },
            taxonCodes: ["en:wheat-flour"],
            tracesCodes: [],
            matchStatus: "MATCHED",
            pieceWeightG: null,
            densityGPerMl: null,
          },
        }),
        line({
          name: "Butter",
          amount: 50,
          unit: "g",
          foodItem: {
            nutrients: { ENERCC: 740 },
            taxonCodes: ["en:butter"],
            tracesCodes: ["en:hazelnut"],
            matchStatus: "MATCHED",
            pieceWeightG: null,
            densityGPerMl: null,
          },
        }),
        line({ name: "Ei", amount: 2, taxonCodes: ["en:eggs"] }),
      ],
    });
    expect(computed.allergens).toEqual(expect.arrayContaining(["en:gluten", "en:milk", "en:eggs"]));
    expect(computed.traces).toEqual(["en:hazelnut"]);
    expect(computed.diets.vegan).toBe("conflict");
    expect(computed.diets.vegetarian).toBe("ok");
    expect(computed.perServing.ENERCC).toBe(535); // (350·2 + 740·0,5) / 2
    expect(computed.nutritionCoverage).toBe(0.67);
    expect(computed.status).toBe("MATCHED");
  });

  it("ungeklärte Zutaten machen das Rezept nur teilweise geprüft", () => {
    const computed = computeRecipe(index, {
      servings: 4,
      ingredients: [
        line({ name: "Reis", taxonCodes: ["en:rice"] }),
        line({ name: "Geheimzutat", status: "UNCLEAR" }),
      ],
    });
    expect(computed.status).toBe("PARTIAL");
    expect(computed.unclearIngredients).toEqual(["Geheimzutat"]);
  });
});

describe("Allergie-Freitext verknüpfen", () => {
  it("Katalog und genaue Namen sind sicher, Wortteile nur Vorschlag", () => {
    expect(linkRestrictionText(index, "Erdnüsse")).toEqual({
      kind: "sure",
      taxonCode: "en:peanuts",
      via: "catalog",
    });
    expect(linkRestrictionText(index, "Haselnuss")).toMatchObject({
      kind: "sure",
      taxonCode: "en:hazelnut",
    });
    expect(linkRestrictionText(index, "Haselnusscreme")).toMatchObject({ kind: "suggestion" });
    expect(linkRestrictionText(index, "Xyz")).toEqual({ kind: "none" });
  });
});

describe("Adressschutz beim Rezept-Import", () => {
  it.each([
    "127.0.0.1",
    "10.43.0.1",
    "192.168.1.5",
    "172.20.0.1",
    "169.254.169.254",
    "::1",
    "fd00::1",
    "::ffff:10.0.0.1",
  ])("sperrt %s", (address) => expect(isBlockedAddress(address)).toBe(true));
  it("erlaubt öffentliche Adressen", () => {
    expect(isBlockedAddress("93.184.216.34")).toBe(false);
    expect(isBlockedAddress("2606:2800:220:1::1")).toBe(false);
  });
});

describe("Lebensmittel zu einer Zutat wählen", () => {
  const item = (nameDe: string, taxonCodes: string[]) => ({
    nameDe,
    taxonCodes,
    matchStatus: "MATCHED" as const,
    groupCode: null,
  });

  it("verwirft Kandidaten mit fremden oder aufhebenden Inhaltsstoffen", () => {
    const candidates = [
      item("Eier-Frischteigwaren roh", ["en:eggs", "en:gluten"]),
      item("Hühnerei roh", ["en:eggs"]),
    ];
    expect(pickFoodItem(index, "Eier", "en:eggs", candidates)?.nameDe).toBe("Hühnerei roh");

    const butter = [item("Butter laktosefrei", ["en:butter", "x:lactose-free-dairy"])];
    expect(pickFoodItem(index, "Butter", "en:butter", butter)).toBeNull();
  });

  it("bevorzugt gleichnamige und rohe Lebensmittel", () => {
    const candidates = [
      item("Weizenmehl Type 1050", ["en:wheat-flour"]),
      item("Weizenmehl Type 405", ["en:wheat-flour"]),
    ];
    expect(pickFoodItem(index, "Weizenmehl", "en:wheat-flour", candidates)).not.toBeNull();
  });
});

describe("Zusätze in Allergie-Texten", () => {
  it.each([
    ["Knoblauch-Unverträglichkeit", "Knoblauch"],
    ["Roher Apfel", "Apfel"],
    ["Linsen (unverarbeitete Hülsenfrüchte)", "Linsen"],
    ["Tomatenallergie", "Tomaten"],
  ])("%s → %s", (input, expected) => expect(stripQualifiers(input)).toBe(expected));

  it("erkennt Texte mit Zusatz sicher", () => {
    expect(linkRestrictionText(index, "Tomaten-Allergie")).toMatchObject({
      kind: "sure",
      taxonCode: "en:tomato",
    });
  });
});
