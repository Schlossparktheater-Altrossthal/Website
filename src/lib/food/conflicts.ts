import type { AllergyLevel, FoodMatchStatus } from "@prisma/client";

import type { DietaryStyleOption, DietaryVariantOption } from "@/data/dietary-preferences";
import { MANUAL_ONLY_CODES, NON_FOOD_CODES } from "@/lib/food/taxonomy/custom";
import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";
import type { TriState } from "@/lib/food/taxonomy/types";

/**
 * Die eine Prüffunktion „darf diese Person das essen?“ (docs/Plan/lebensmittel-standard-plan.md).
 * Alle späteren Bausteine (Rezepte, Essensplan) nutzen nur sie. Sie ist rein: Taxonomie,
 * Person und Lebensmittel kommen als Daten herein.
 *
 * Grundsatz: Was nicht sicher geklärt ist, ist nie „ok“, sondern „manuell prüfen“.
 */

export type PersonRestriction = {
  label: string;
  taxonCode: string | null;
  level: AllergyLevel;
  /** `null` = nicht angegeben → Spuren gelten als Risiko. */
  tracesOk: boolean | null;
};

export type PersonDietProfile = {
  restrictions: PersonRestriction[];
  style: DietaryStyleOption | null;
  variant?: DietaryVariantOption | null;
  strictness?: "strict" | "flexible" | "situational" | null;
  /** Abneigungen (nicht medizinisch) – werden nur als Hinweis gemeldet. */
  aversions?: { label: string }[];
};

export type FoodProfile = {
  /** Taxa eines einzelnen Lebensmittels. */
  codes: string[];
  /**
   * Bei Rezepten: Taxa je Zutat. „-frei“-Angaben (laktosefreie Milch) gelten nur innerhalb ihrer
   * Zutat, nicht für das ganze Rezept. Fehlt das Feld, ist `codes` eine Zutat.
   */
  components?: string[][];
  /** „Kann Spuren enthalten“. */
  traces?: string[];
  /** Zuordnungsstand; PARTIAL/UNCLEAR bedeutet: Inhaltsangaben evtl. unvollständig. */
  status: FoodMatchStatus;
};

export type ConflictReason =
  | { type: "restriction"; code: string; label: string; level: AllergyLevel }
  | { type: "traces"; code: string; label: string; level: AllergyLevel }
  | { type: "diet"; style: DietaryStyleOption; rule: string; soft: boolean }
  | { type: "unresolved"; label: string }
  | { type: "manual"; code: string; label: string }
  | { type: "incomplete" }
  | { type: "aversion"; label: string };

export type ConflictVerdict = "ok" | "check" | "conflict";

export type ConflictResult = { verdict: ConflictVerdict; reasons: ConflictReason[] };

const MEAT_MARKERS = ["en:meat", "en:poultry", "en:animal", "en:gelatin"];
const SEAFOOD_MARKERS = ["en:fish", "en:shellfish", "en:crustaceans", "en:molluscs"];
const EGG_MARKERS = ["en:egg", "en:eggs"];
const DAIRY_MARKERS = ["en:dairy", "en:milk"];
const PORK_MARKERS = ["en:pork"];
const ALCOHOL_MARKERS = ["en:alcohol"];

export function checkFood(
  index: TaxonIndex,
  person: PersonDietProfile,
  food: FoodProfile,
): ConflictResult {
  const reasons: ConflictReason[] = [];
  const components = food.components ?? [food.codes];
  const contains = new Set(components.flatMap((codes) => [...index.closureOf(codes)]));
  const allCodes = components.flat();
  const traces = index.closureOf(food.traces ?? []);
  let relevant = false;

  for (const restriction of person.restrictions) {
    const code = restriction.taxonCode;
    if (code && NON_FOOD_CODES.has(code)) continue;
    relevant = true;
    if (!code) {
      reasons.push({ type: "unresolved", label: restriction.label });
      continue;
    }
    if (contains.has(code)) {
      reasons.push({
        type: "restriction",
        code,
        label: restriction.label,
        level: restriction.level,
      });
      continue;
    }
    if (traces.has(code) && restriction.tracesOk !== true) {
      reasons.push({ type: "traces", code, label: restriction.label, level: restriction.level });
      continue;
    }
    if (MANUAL_ONLY_CODES.has(code) && allCodes.length > 0) {
      reasons.push({ type: "manual", code, label: restriction.label });
    }
  }

  if (person.style) {
    const dietReasons = checkDiet(index, person, allCodes, contains);
    if (person.style !== "omnivore") relevant = true;
    reasons.push(...dietReasons);
  }

  if (relevant && food.status !== "MATCHED" && food.status !== "MANUAL") {
    reasons.push({ type: "incomplete" });
  }

  for (const aversion of person.aversions ?? []) {
    const hits = index.matchText(aversion.label);
    if (hits.some((hit) => contains.has(hit.code))) {
      reasons.push({ type: "aversion", label: aversion.label });
    }
  }

  return { verdict: verdictOf(reasons), reasons };
}

function checkDiet(
  index: TaxonIndex,
  person: PersonDietProfile,
  codes: string[],
  contains: ReadonlySet<string>,
): ConflictReason[] {
  const style = person.style;
  if (!style) return [];
  const soft = person.strictness === "situational";
  const has = (markers: string[]) => markers.some((marker) => contains.has(marker));
  const property = (name: "vegan" | "vegetarian") =>
    worstOf(codes.map((code) => index.dietProperty(code, name)));
  const reasons: ConflictReason[] = [];
  const conflict = (rule: string) => reasons.push({ type: "diet", style, rule, soft });
  const unsure = (rule: string) => reasons.push({ type: "diet", style, rule, soft: true });

  switch (style) {
    case "vegan": {
      const vegan = property("vegan");
      if (
        vegan === "no" ||
        has([...MEAT_MARKERS, ...SEAFOOD_MARKERS, ...EGG_MARKERS, ...DAIRY_MARKERS])
      ) {
        conflict("nicht vegan");
      } else if (vegan === "maybe") unsure("vegan unklar");
      break;
    }
    case "vegetarian": {
      const vegetarian = property("vegetarian");
      if (vegetarian === "no" || has([...MEAT_MARKERS, ...SEAFOOD_MARKERS])) {
        conflict("nicht vegetarisch");
      } else if (vegetarian === "maybe") unsure("vegetarisch unklar");
      if (person.variant === "lacto" && has(EGG_MARKERS)) conflict("enthält Ei");
      if (person.variant === "ovo" && has(DAIRY_MARKERS)) conflict("enthält Milch");
      break;
    }
    case "pescetarian":
      if (has(MEAT_MARKERS)) conflict("enthält Fleisch");
      break;
    case "halal":
      if (has(PORK_MARKERS)) conflict("enthält Schwein");
      if (has(ALCOHOL_MARKERS)) conflict("enthält Alkohol");
      if (!has(PORK_MARKERS) && has(MEAT_MARKERS)) unsure("Fleisch: Herkunft/Schlachtung prüfen");
      break;
    case "kosher":
      if (has(PORK_MARKERS)) conflict("enthält Schwein");
      if (has(["en:shellfish", "en:crustaceans", "en:molluscs"])) conflict("enthält Meeresfrüchte");
      if (has(MEAT_MARKERS) && has(DAIRY_MARKERS)) conflict("Fleisch und Milch zusammen");
      else if (has(MEAT_MARKERS)) unsure("Fleisch: Herkunft prüfen");
      break;
    case "custom":
      unsure("individueller Stil");
      break;
    case "omnivore":
    case "flexitarian":
      break;
  }
  return reasons;
}

function verdictOf(reasons: ConflictReason[]): ConflictVerdict {
  let verdict: ConflictVerdict = "ok";
  for (const reason of reasons) {
    if (reason.type === "aversion") continue;
    const hard =
      reason.type === "restriction" ||
      reason.type === "traces" ||
      (reason.type === "diet" && !reason.soft);
    if (hard) return "conflict";
    verdict = "check";
  }
  return verdict;
}

function worstOf(values: (TriState | null)[]): TriState | null {
  if (values.includes("no")) return "no";
  if (values.includes("maybe")) return "maybe";
  if (values.includes("yes")) return "yes";
  return null;
}
