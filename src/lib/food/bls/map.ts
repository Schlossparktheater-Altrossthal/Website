import type { FoodMatchStatus } from "@prisma/client";

import type { BlsFood } from "@/lib/food/bls/parse";
import { normalizeFoodText } from "@/lib/food/normalize";
import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";

/**
 * Adapter BLS → Taxonomie. Der BLS liefert Nährwerte, aber keine Allergene. Die Zuordnung
 * kommt aus drei Quellen, in dieser Reihenfolge:
 *
 * 1. Name (DE, sonst EN) gegen die Taxonomie (`TaxonIndex.matchText`)
 * 2. Hauptgruppe des BLS-Codes (erster Buchstabe) als Grundannahme, z. B. Brot → Gluten
 * 3. Nährwerte: Laktose, Alkohol, Sorbit, freie Fruktose sind gemessen und damit sicherer als
 *    jeder Name
 *
 * Bezeichnungen wie „glutenfrei“, „eifrei“, „laktosefrei“, „vegan“ heben Grundannahmen auf.
 */

type GroupRule = { taxa: string[]; composite: boolean };

/** Hauptgruppen BLS 4.0 (siehe Dokumentation). `composite` = zusammengesetzte Lebensmittel. */
const GROUP_RULES: Readonly<Record<string, GroupRule>> = {
  B: { taxa: ["en:gluten"], composite: true }, // Brot und Kleingebäck
  C: { taxa: [], composite: false }, // Getreide
  D: { taxa: ["en:gluten"], composite: true }, // Dauerbackwaren, Kuchen
  E: { taxa: ["en:gluten", "en:egg"], composite: true }, // Teigwaren
  F: { taxa: [], composite: false }, // Obst
  G: { taxa: [], composite: false }, // Gemüse
  H: { taxa: [], composite: false }, // Hülsenfrüchte, Nüsse, Samen
  K: { taxa: [], composite: false }, // Kartoffeln, Pilze
  M: { taxa: ["en:dairy"], composite: false }, // Milch, Milchprodukte, Käse
  N: { taxa: [], composite: true }, // Getränke ohne Alkohol
  P: { taxa: ["en:alcohol"], composite: true }, // alkoholische Getränke
  Q: { taxa: [], composite: false }, // Fette, Öle
  R: { taxa: [], composite: true }, // Gewürze, Würzmittel, Zutaten
  S: { taxa: [], composite: true }, // Süßwaren, Zucker
  T: { taxa: ["en:fish"], composite: false }, // Fisch, Meeresfrüchte
  U: { taxa: ["en:meat"], composite: false }, // Fleisch
  V: { taxa: ["en:meat"], composite: false }, // Wild, Geflügel, Innereien
  W: { taxa: ["en:meat"], composite: true }, // Wurst, Fleischwaren
  X: { taxa: [], composite: true }, // Gerichte, Fertiggerichte
  Y: { taxa: [], composite: true }, // Speisen, Rezepturen
};

const EGG_RULE: GroupRule = { taxa: ["en:eggs"], composite: false };

const NEGATIONS: readonly { pattern: RegExp; removes: string[] }[] = [
  { pattern: /\bglutenfrei/, removes: ["en:gluten"] },
  { pattern: /\beifrei|\bohne ei\b/, removes: ["en:egg", "en:eggs"] },
  { pattern: /\blaktosefrei/, removes: ["en:lactose"] },
  {
    pattern: /\bvegan/,
    removes: ["en:dairy", "en:egg", "en:eggs", "en:meat", "en:fish", "en:milk", "en:lactose"],
  },
  { pattern: /\balkoholfrei/, removes: ["en:alcohol"] },
];

/** Schwellen je 100 g, ab denen ein gemessener Inhaltsstoff als enthalten gilt. */
const NUTRIENT_RULES: readonly { nutrient: string; min: number; taxa: string[] }[] = [
  // Laktose kommt praktisch nur aus Milch → auch Milcheiweiß.
  { nutrient: "LACS", min: 0.1, taxa: ["en:lactose", "en:milk"] },
  { nutrient: "ALC", min: 0.5, taxa: ["en:alcohol"] },
  { nutrient: "SORTL", min: 0.5, taxa: ["x:sorbitol"] },
];

/** Freie Fruktose (Fruktose über Glukose) ab diesem Überschuss je 100 g. */
const FREE_FRUCTOSE_MIN = 0.5;

export type BlsMapping = {
  groupCode: string;
  taxonCodes: string[];
  matchStatus: FoodMatchStatus;
};

/** Zubereitungs- und Mengenangaben, die für die Zuordnung nichts beitragen. */
const PREPARATION_PATTERN = new RegExp(
  [
    String.raw`\b(?:mit|ohne) (?:fett(?: und salz)?|salz|haut|knochen)\b`,
    String.raw`\b(?:roh|gekocht|gedunstet|gebraten|gebacken|gegrillt|geschmort|frittiert|tiefgefroren|getrocknet|konserve|abgetropft|gerostet|blanchiert|pochiert|gegart|gezuckert|ungezuckert|gesusst|ungesusst|natur|pfanne|ofen)\b`,
    String.raw`\b(?:mind|max|i tr|fett|fettarm|fettreduziert|vollfett)\b`,
    String.raw`\b\d+(?: \d+)? ?%?`,
  ].join("|"),
  "g",
);

/** Name ohne Klammern und Zubereitung, normalisiert („Hafer ganzes Korn, roh“ → „hafer ganzes korn“). */
export function cleanBlsName(name: string): string {
  const withoutBrackets = name.replace(/\([^)]*\)/g, " ");
  return normalizeFoodText(withoutBrackets)
    .replace(PREPARATION_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Genaue Zuordnung über den Hauptteil vor dem Komma. „/“ trennt Alternativen: Synonyme
 * („Rote Rübe/Rote Bete“) oder Mischungen („Rind/Schwein“) – deshalb zählen alle Treffer.
 * `complete` ist wahr, wenn jede Alternative genau erkannt wurde.
 */
function exactMatches(index: TaxonIndex, name: string): { codes: string[]; complete: boolean } {
  const main = name.split(",")[0] ?? name;
  const whole = index.matchExact(cleanBlsName(main));
  if (whole) return { codes: [whole.code], complete: true };
  const alternatives = main.split("/").map(cleanBlsName).filter(Boolean);
  const hits = alternatives.map((alternative) => index.matchExact(alternative));
  const codes = hits.flatMap((hit) => (hit ? [hit.code] : []));
  return { codes, complete: codes.length > 0 && hits.every(Boolean) };
}

export function mapBlsFood(food: BlsFood, index: TaxonIndex): BlsMapping {
  const groupCode = food.code.charAt(0).toUpperCase();
  // In Gruppe E stehen Eier (E1…) und Teigwaren (übrige) zusammen.
  const rule = food.code.toUpperCase().startsWith("E1")
    ? EGG_RULE
    : (GROUP_RULES[groupCode] ?? { taxa: [], composite: true });
  const normalized = normalizeFoodText(food.nameDe);

  const exact = exactMatches(index, food.nameDe);
  // Klammern bleiben für die Wortsuche erhalten: „(mit Gelatine)“, „(Mürbeteig)“ sind Inhalte.
  const searchText = normalized.replace(PREPARATION_PATTERN, " ");
  // Einfache Lebensmittel mit sicherem Namen: nur der Name. Gerichte und unsichere Namen: zusätzlich
  // jede erkannte Zutat im ganzen Text („Zwiebeln gedünstet, mit Speck“).
  const wordMatches =
    exact.complete && !rule.composite ? [] : index.matchText(searchText).map((m) => m.code);
  let codes = [...new Set([...exact.codes, ...wordMatches])];
  if (codes.length === 0 && food.nameEn) {
    const english = exactMatches(index, food.nameEn);
    codes =
      english.codes.length > 0 ? english.codes : index.matchText(food.nameEn).map((m) => m.code);
  }

  const taxa = new Set<string>(codes);

  // Gruppenannahme nur, wenn der Name sie nicht schon genauer abdeckt (Garnele statt Fisch).
  for (const groupTaxon of rule.taxa) {
    const covered = [...taxa].some((code) => index.closure(code).has(groupTaxon));
    const seafoodInstead =
      groupTaxon === "en:fish" &&
      [...taxa].some((code) => {
        const closure = index.closure(code);
        return (
          closure.has("en:crustaceans") || closure.has("en:molluscs") || closure.has("en:shellfish")
        );
      });
    // Fleisch-/Fischgruppe: schon eine Tierart erkannt (Huhn, Garnele) → keine Grundannahme.
    const animalKnown =
      (groupTaxon === "en:meat" || groupTaxon === "en:fish") &&
      [...taxa].some((code) => index.dietProperty(code, "vegetarian") === "no");
    if (!covered && !seafoodInstead && !animalKnown) taxa.add(groupTaxon);
  }

  for (const { nutrient, min, taxa: implied } of NUTRIENT_RULES) {
    if ((food.nutrients[nutrient] ?? 0) >= min) implied.forEach((code) => taxa.add(code));
  }
  const freeFructose = (food.nutrients.FRUS ?? 0) - (food.nutrients.GLUS ?? 0);
  if (freeFructose >= FREE_FRUCTOSE_MIN) taxa.add("x:fructose-malabsorption");

  let laktosefrei = false;
  for (const { pattern, removes } of NEGATIONS) {
    if (!pattern.test(normalized)) continue;
    removes.forEach((code) => taxa.delete(code));
    if (removes.includes("en:lactose")) laktosefrei = true;
  }
  // Milchprodukt ohne Laktose: über das eigene Taxon, damit die Hülle Laktose nicht wieder erbt.
  if (laktosefrei && (taxa.delete("en:dairy") || groupCode === "M")) {
    taxa.add("x:lactose-free-dairy");
  }

  const knownTaxa = [...taxa].filter((code) => index.has(code));
  let matchStatus: FoodMatchStatus;
  if (knownTaxa.length === 0) matchStatus = "UNCLEAR";
  else if (exact.complete && !rule.composite) matchStatus = "MATCHED";
  else matchStatus = "PARTIAL";

  return { groupCode, taxonCodes: knownTaxa.sort(), matchStatus };
}
