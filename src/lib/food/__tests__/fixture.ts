import { applyCustomOverrides } from "@/lib/food/taxonomy/custom";
import { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";
import type { TaxonRecord } from "@/lib/food/taxonomy/types";

type Partial_ = Partial<TaxonRecord> & { code: string };

function taxon(input: Partial_): TaxonRecord {
  return {
    kind: "INGREDIENT",
    source: "OFF",
    nameDe: null,
    nameEn: null,
    synonymsDe: [],
    synonymsEn: [],
    parentCodes: [],
    allergenCodes: [],
    impliesCodes: [],
    vegan: null,
    vegetarian: null,
    lmiv: false,
    ...input,
  };
}

/** Ausschnitt der echten OFF-Struktur (Stand 2026-10) für Tests. */
export const FIXTURE_RECORDS: TaxonRecord[] = [
  taxon({ code: "en:nuts", kind: "ALLERGEN", nameDe: "Schalenfrüchte", lmiv: true }),
  taxon({ code: "en:gluten", kind: "ALLERGEN", nameDe: "Gluten", lmiv: true }),
  taxon({ code: "en:milk", kind: "ALLERGEN", nameDe: "Milch", lmiv: true }),
  taxon({ code: "en:peanuts", kind: "ALLERGEN", nameDe: "Erdnüsse", lmiv: true }),
  taxon({ code: "en:eggs", kind: "ALLERGEN", nameDe: "Eier", lmiv: true }),
  taxon({
    code: "en:fish",
    kind: "ALLERGEN",
    nameDe: "Fisch",
    synonymsDe: ["Fische"],
    allergenCodes: ["en:fish"],
    vegan: "no",
    vegetarian: "no",
    lmiv: true,
  }),
  taxon({ code: "en:nut", nameDe: "Nüssen" }),
  taxon({
    code: "en:tree-nut",
    nameDe: "Baumnüsse",
    parentCodes: ["en:nut"],
    allergenCodes: ["en:nuts"],
  }),
  taxon({
    code: "en:hazelnut",
    nameDe: "Haselnuss",
    synonymsDe: ["Haselnüsse"],
    parentCodes: ["en:tree-nut"],
  }),
  taxon({ code: "en:almond", nameDe: "Mandel", parentCodes: ["en:tree-nut"] }),
  taxon({
    code: "en:peanut",
    nameDe: "Erdnuss",
    parentCodes: ["en:nut"],
    allergenCodes: ["en:peanuts"],
  }),
  taxon({ code: "en:cereal", nameDe: "Getreide" }),
  taxon({
    code: "en:wheat",
    nameDe: "Weizen",
    parentCodes: ["en:cereal"],
    allergenCodes: ["en:gluten"],
  }),
  taxon({ code: "en:wheat-flour", nameDe: "Weizenmehl", parentCodes: ["en:wheat"] }),
  taxon({ code: "en:oat", nameDe: "hafer", parentCodes: ["en:cereal"] }),
  taxon({ code: "en:rice", nameDe: "Reis", parentCodes: ["en:cereal"] }),
  taxon({ code: "en:dairy", nameDe: "Milcherzeugnisse", vegan: "no", vegetarian: "maybe" }),
  taxon({
    code: "en:butter",
    nameDe: "Butter",
    parentCodes: ["en:dairy"],
    vegan: "no",
    vegetarian: "yes",
  }),
  taxon({ code: "en:lactose", nameDe: "Laktose", synonymsDe: ["Milchzucker"] }),
  taxon({ code: "en:lactose-free-cream", nameDe: "Laktosefreie Sahne", parentCodes: ["en:dairy"] }),
  taxon({
    code: "en:egg",
    nameDe: "Ei",
    vegan: "no",
    vegetarian: "yes",
    allergenCodes: ["en:eggs"],
  }),
  taxon({ code: "en:meat", nameDe: "Fleisch", vegan: "no", vegetarian: "no" }),
  taxon({ code: "en:animal", nameDe: "Tier" }),
  taxon({ code: "en:pork", nameDe: "Schwein", parentCodes: ["en:animal"] }),
  taxon({ code: "en:beef", nameDe: "Rind", parentCodes: ["en:animal"] }),
  taxon({ code: "en:poultry", nameDe: "Geflügel", vegan: "no", vegetarian: "no" }),
  taxon({ code: "en:chicken", nameDe: "Huhn", parentCodes: ["en:poultry"] }),
  taxon({ code: "en:salmon", nameDe: "Lachs", parentCodes: ["en:fish"] }),
  taxon({ code: "en:alcohol", nameDe: "Alkohol" }),
  taxon({ code: "en:wine", nameDe: "Wein", parentCodes: ["en:alcohol"] }),
  taxon({ code: "en:tomato", nameDe: "Tomate" }),
  taxon({ code: "en:chocolate", nameDe: "Schokolade" }),
  taxon({ code: "en:sugar", nameDe: "Zucker", vegan: "yes", vegetarian: "yes" }),
];

export function fixtureIndex(aliases: [string, string][] = []): TaxonIndex {
  return new TaxonIndex(
    applyCustomOverrides(FIXTURE_RECORDS.map((record) => ({ ...record }))),
    aliases,
  );
}
