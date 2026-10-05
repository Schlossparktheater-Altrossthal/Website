import type { TaxonRecord, TriState } from "@/lib/food/taxonomy/types";

/**
 * Eigene Ergänzungen zur Open-Food-Facts-Taxonomie (docs/Plan/lebensmittel-standard-plan.md).
 *
 * OFF ist die Grundlage, hat aber Lücken, die für die Verpflegung gefährlich wären (Hafer ohne
 * Gluten, Milchprodukte ohne Laktose …). Ergänzungen stehen ausschließlich hier und werden beim
 * Import über die OFF-Daten gelegt – so bleibt ein OFF-Update ein reiner Re-Import.
 *
 * Eigene Codes tragen das Präfix `x:`.
 */

/** Die 14 kennzeichnungspflichtigen Allergene (LMIV Anhang II) als OFF-Allergen-Codes. */
export const LMIV_ALLERGEN_CODES = [
  "en:gluten",
  "en:crustaceans",
  "en:eggs",
  "en:fish",
  "en:peanuts",
  "en:soybeans",
  "en:milk",
  "en:nuts",
  "en:celery",
  "en:mustard",
  "en:sesame-seeds",
  "en:sulphur-dioxide-and-sulphites",
  "en:lupin",
  "en:molluscs",
] as const;

type CustomTaxon = Pick<TaxonRecord, "code" | "kind" | "nameDe" | "nameEn"> & {
  synonymsDe?: string[];
  parentCodes?: string[];
  /**
   * Nicht automatisch prüfbar: Treffer lassen sich aus Zutaten nicht sicher ableiten
   * (FODMAP, Kreuzallergien …). Die Prüfung meldet dann immer „manuell prüfen“.
   */
  manualOnly?: boolean;
  /** Betrifft keine Lebensmittel (Latex, Medikamente) – für die Verpflegung ohne Bedeutung. */
  nonFood?: boolean;
};

export const CUSTOM_TAXA: readonly CustomTaxon[] = [
  // Kennzeichnungen „glutenfrei“/„laktosefrei“ eines Produkts (OFF-Labels): heben Gluten bzw.
  // Laktose für genau dieses Lebensmittel auf (siehe NEGATING_PATTERNS in taxon-index.ts).
  {
    code: "x:label-gluten-free",
    kind: "INGREDIENT",
    nameDe: "Glutenfrei (Kennzeichnung)",
    nameEn: "Gluten-free (label)",
  },
  {
    code: "x:label-lactose-free",
    kind: "INGREDIENT",
    nameDe: "Laktosefrei (Kennzeichnung)",
    nameEn: "Lactose-free (label)",
  },
  {
    code: "x:lactose-free-dairy",
    kind: "INGREDIENT",
    nameDe: "Laktosefreie Milchprodukte",
    nameEn: "Lactose-free dairy",
    synonymsDe: ["laktosefreie Milch"],
    parentCodes: ["en:dairy"],
  },
  {
    code: "x:histamine",
    kind: "SENSITIVITY",
    nameDe: "Histamin",
    nameEn: "Histamine",
    synonymsDe: ["Histaminintoleranz"],
  },
  {
    code: "x:alpha-gal",
    kind: "SENSITIVITY",
    nameDe: "Alpha-Gal (Säugetierfleisch)",
    nameEn: "Alpha-gal",
    synonymsDe: ["Alpha-Gal-Syndrom", "Fleischallergie", "rotes Fleisch"],
  },
  {
    code: "x:nightshades",
    kind: "SENSITIVITY",
    nameDe: "Nachtschattengewächse",
    nameEn: "Nightshades",
    synonymsDe: ["Nachtschatten"],
  },
  {
    code: "x:sorbitol",
    kind: "SENSITIVITY",
    nameDe: "Sorbit",
    nameEn: "Sorbitol",
    synonymsDe: ["Sorbitintoleranz", "Sorbitol"],
  },
  {
    code: "x:fructose-malabsorption",
    kind: "SENSITIVITY",
    nameDe: "Fruktose (Malabsorption)",
    nameEn: "Fructose malabsorption",
    synonymsDe: ["Fruktoseintoleranz", "Fructoseintoleranz", "Fruchtzucker"],
  },
  {
    code: "x:phenylalanine",
    kind: "SENSITIVITY",
    nameDe: "Phenylalanin (PKU)",
    nameEn: "Phenylalanine",
    synonymsDe: ["Phenylketonurie", "PKU", "Aspartam"],
    manualOnly: true,
  },
  {
    code: "x:fodmap",
    kind: "SENSITIVITY",
    nameDe: "FODMAP",
    nameEn: "FODMAP",
    synonymsDe: ["Reizdarm", "Low FODMAP"],
    manualOnly: true,
  },
  {
    code: "x:pollen-cross-reactivity",
    kind: "SENSITIVITY",
    nameDe: "Kreuzallergie (Pollen)",
    nameEn: "Pollen cross-reactivity",
    synonymsDe: ["Kreuzallergie", "Birkenpollen", "orales Allergiesyndrom"],
    manualOnly: true,
  },
  {
    code: "x:additives",
    kind: "SENSITIVITY",
    nameDe: "Zusatzstoffe",
    nameEn: "Additives",
    synonymsDe: ["Konservierungsstoffe", "Farbstoffe", "Geschmacksverstärker", "Glutamat"],
    manualOnly: true,
  },
  {
    code: "x:latex",
    kind: "SENSITIVITY",
    nameDe: "Latex",
    nameEn: "Latex",
    synonymsDe: ["Naturlatex"],
    nonFood: true,
  },
  {
    code: "x:medication",
    kind: "SENSITIVITY",
    nameDe: "Medikamente",
    nameEn: "Medication",
    synonymsDe: ["Penicillin", "Antibiotika"],
    nonFood: true,
  },
  {
    code: "x:insect-venom",
    kind: "SENSITIVITY",
    nameDe: "Insektengift",
    nameEn: "Insect venom",
    synonymsDe: ["Bienenstich", "Wespenstich"],
    nonFood: true,
  },
];

export const MANUAL_ONLY_CODES: ReadonlySet<string> = new Set(
  CUSTOM_TAXA.filter((taxon) => taxon.manualOnly).map((taxon) => taxon.code),
);

export const NON_FOOD_CODES: ReadonlySet<string> = new Set(
  CUSTOM_TAXA.filter((taxon) => taxon.nonFood).map((taxon) => taxon.code),
);

/**
 * Zusätzliche Auslöser je OFF-Code („X enthält/löst aus Y“). Vererbt sich über den Baum: was
 * für `en:dairy` gilt, gilt für jeden Käse.
 */
export const TAXON_IMPLIES: Readonly<Record<string, readonly string[]>> = {
  // Hafer zählt nach LMIV zu den glutenhaltigen Getreiden; OFF führt ihn ohne Gluten.
  "en:oat": ["en:gluten"],
  "en:barley": ["en:gluten"],
  "en:rye": ["en:gluten"],
  // Nudeln ohne Zusatz sind Weizen-/Hartweizennudeln; OFF hängt sie nur an en:dough. Lieber eine
  // Warnung zu viel – glutenfreie Nudeln lassen sich von Hand zuordnen.
  "en:pasta": ["en:gluten", "en:wheat"],
  "en:noodle": ["en:gluten", "en:wheat"],
  // Milch und Milchprodukte enthalten Laktose (laktosefreie Produkte kommen über Nährwerte/OFF).
  "en:dairy": ["en:lactose", "en:milk"],
  "en:milk": ["en:lactose"],
  // Säugetierfleisch: Alpha-Gal.
  "en:beef": ["x:alpha-gal"],
  "en:pork": ["x:alpha-gal"],
  "en:lamb": ["x:alpha-gal"],
  "en:sheep": ["x:alpha-gal"],
  "en:goat": ["x:alpha-gal"],
  "en:veal": ["x:alpha-gal"],
  "en:venison": ["x:alpha-gal"],
  "en:rabbit": ["x:alpha-gal"],
  // Nachtschattengewächse.
  "en:tomato": ["x:nightshades"],
  "en:potato": ["x:nightshades"],
  "en:capsicum-annuum": ["x:nightshades"],
  "en:chili-pepper": ["x:nightshades"],
  "en:aubergine": ["x:nightshades"],
  // Histaminreiche Lebensmittel (Auswahl, Teilabdeckung).
  "en:cheese": ["x:histamine"],
  "en:wine": ["x:histamine"],
  "en:beer": ["x:histamine"],
  "en:sauerkraut": ["x:histamine"],
  "en:tuna": ["x:histamine"],
  "en:mackerel": ["x:histamine"],
  "en:salami": ["x:histamine"],
  "en:spinach": ["x:histamine"],
  "en:vinegar": ["x:histamine"],
  "en:yeast-extract": ["x:histamine"],
  "en:soy-sauce": ["x:histamine"],
  // Fruktose: freie Fruktose als Zutat und fruktosereiche Lebensmittel (Auswahl).
  "en:fructose": ["x:fructose-malabsorption"],
  "en:honey": ["x:fructose-malabsorption"],
  "en:agave-syrup": ["x:fructose-malabsorption"],
  "en:apple": ["x:fructose-malabsorption"],
  "en:pear": ["x:fructose-malabsorption"],
};

/**
 * Feste Zuordnungen Text → Taxon, die OFF nicht oder anders kennt. Werden beim Import als
 * Aliase (Quelle AUTO) angelegt; von Menschen bestätigte Aliase gehen vor.
 */
export const CUSTOM_ALIASES: Readonly<Record<string, string>> = {
  Nüsse: "en:nuts",
  Nüssen: "en:nuts",
  Schalenfrüchte: "en:nuts",
  Baumnüsse: "en:nuts",
  Milch: "en:milk",
  Kuhmilch: "en:milk",
  Milcheiweiß: "en:milk",
  Milchallergie: "en:milk",
  Ei: "en:eggs",
  Eier: "en:eggs",
  Hühnerei: "en:eggs",
  Rührei: "en:eggs",
  Spiegelei: "en:eggs",
  Eigelb: "en:eggs",
  Eiklar: "en:eggs",
  Eiweiß: "en:eggs",
  Glutenunverträglichkeit: "en:gluten",
  Zöliakie: "en:gluten",
  Laktoseintoleranz: "en:lactose",
  Fructoseintoleranz: "x:fructose-malabsorption",
  "Fructose-Intoleranz": "x:fructose-malabsorption",
  "Fruktose-Intoleranz": "x:fructose-malabsorption",
  Fructosemalabsorption: "x:fructose-malabsorption",
  Steinobst: "en:prunus-species-fruit",
  Erdnuss: "en:peanuts",
  Erdnüsse: "en:peanuts",
  Soja: "en:soybeans",
  Sesam: "en:sesame-seeds",
  Sulfite: "en:sulphur-dioxide-and-sulphites",
  Schwefeldioxid: "en:sulphur-dioxide-and-sulphites",
  Lupine: "en:lupin",
  Lupinen: "en:lupin",
  Weichtiere: "en:molluscs",
  Krebstiere: "en:crustaceans",
  Meeresfrüchte: "en:shellfish",
  Alkohol: "en:alcohol",
  // In deutschen Rezepten ist „Mehl“ ohne Zusatz Weizenmehl – OFF führt en:flour ohne Getreide,
  // dann fehlte Gluten.
  Mehl: "en:wheat-flour",
  Spätzlemehl: "en:wheat-flour",
  // Sonst greift der Wortanfang „Torte“ (Tortellini → Kuchen).
  Tortellini: "en:pasta",
  Tortelloni: "en:pasta",
  Ravioli: "en:pasta",
  Romadur: "en:soft-cheese",
  Weißlacker: "en:soft-cheese",
};

/**
 * Korrekturen der OFF-Eigenschaften vegan/vegetarian. OFF hängt Tierarten (Schwein, Rind, Lamm)
 * an `en:animal` ohne Eigenschaft – ohne Korrektur gälte Schweinefleisch als vegetarisch.
 */
export const DIET_PROPERTY_OVERRIDES: Readonly<
  Record<string, { vegan?: TriState; vegetarian?: TriState }>
> = {
  "en:animal": { vegan: "no", vegetarian: "no" },
  "en:gelatin": { vegan: "no", vegetarian: "no" },
  "en:lactose": { vegan: "no", vegetarian: "yes" },
  // Milch selbst ist vegetarisch; „maybe“ von en:dairy gilt nur für Käse (Lab).
  "en:milk": { vegan: "no", vegetarian: "yes" },
  "en:meat-stock": { vegan: "no", vegetarian: "no" },
  "en:broth": { vegan: "maybe", vegetarian: "maybe" },
};

/**
 * Codes der bisherigen Vorschlagsliste (`src/data/allergens.ts`) → Taxon. Grundlage für die
 * automatische Verknüpfung bestehender Einträge.
 */
export const CATALOG_VALUE_TO_TAXON: Readonly<Record<string, string>> = {
  gluten: "en:gluten",
  crustaceans: "en:crustaceans",
  eggs: "en:eggs",
  fish: "en:fish",
  peanuts: "en:peanuts",
  soy: "en:soybeans",
  "milk-protein": "en:milk",
  "tree-nuts": "en:nuts",
  celery: "en:celery",
  mustard: "en:mustard",
  sesame: "en:sesame-seeds",
  sulphites: "en:sulphur-dioxide-and-sulphites",
  lupin: "en:lupin",
  molluscs: "en:molluscs",
  lactose: "en:lactose",
  fructose: "x:fructose-malabsorption",
  histamine: "x:histamine",
  sorbitol: "x:sorbitol",
  "cross-allergy": "x:pollen-cross-reactivity",
  "insect-venom": "x:insect-venom",
  medication: "x:medication",
  latex: "x:latex",
  additives: "x:additives",
  alcohol: "en:alcohol",
};

export function customTaxonRecords(): TaxonRecord[] {
  return CUSTOM_TAXA.map((taxon) => ({
    code: taxon.code,
    kind: taxon.kind,
    source: "CUSTOM",
    nameDe: taxon.nameDe,
    nameEn: taxon.nameEn,
    synonymsDe: taxon.synonymsDe ?? [],
    synonymsEn: [],
    parentCodes: taxon.parentCodes ?? [],
    allergenCodes: [],
    impliesCodes: [],
    vegan: null,
    vegetarian: null,
    lmiv: false,
  }));
}

/** Legt die eigenen Ergänzungen über OFF-Datensätze (Import). */
export function applyCustomOverrides(records: TaxonRecord[]): TaxonRecord[] {
  const byCode = new Map(records.map((record) => [record.code, record]));
  for (const custom of customTaxonRecords()) {
    if (!byCode.has(custom.code)) byCode.set(custom.code, custom);
  }
  for (const [code, implies] of Object.entries(TAXON_IMPLIES)) {
    const record = byCode.get(code);
    if (record) record.impliesCodes = [...new Set([...record.impliesCodes, ...implies])];
  }
  for (const [code, override] of Object.entries(DIET_PROPERTY_OVERRIDES)) {
    const record = byCode.get(code);
    if (!record) continue;
    if (override.vegan) record.vegan = override.vegan;
    if (override.vegetarian) record.vegetarian = override.vegetarian;
  }
  return [...byCode.values()];
}
