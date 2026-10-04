import { LMIV_ALLERGEN_CODES } from "@/lib/food/taxonomy/custom";
import { toTriState, type TaxonRecord } from "@/lib/food/taxonomy/types";

/**
 * Parser für die Open-Food-Facts-Taxonomien (ODbL). Eingaben sind die veröffentlichten Dateien:
 *
 * - `ingredients.json` / `allergens.json` (static.openfoodfacts.org/data/taxonomies/): Baum,
 *   Namen, Eigenschaften (allergens, vegan, vegetarian)
 * - `ingredients.txt` (Quelltext im openfoodfacts-server-Repo): zusätzlich alle Synonyme
 *
 * Nur Deutsch und Englisch werden übernommen.
 */

type OffJsonEntry = {
  name?: Record<string, string>;
  parents?: string[];
  allergens?: Record<string, string>;
  vegan?: Record<string, string>;
  vegetarian?: Record<string, string>;
};

export type OffJsonTaxonomy = Record<string, OffJsonEntry>;

export type OffSynonyms = Map<string, { de: string[]; en: string[] }>;

/** Kennung, wie OFF sie aus dem ersten Namen eines Eintrags bildet (vereinfacht). */
export function offSlug(language: string, name: string): string {
  const slug = name
    .trim()
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${language}:${slug}`;
}

/**
 * Liest die Synonyme je Eintrag aus dem Taxonomie-Quelltext. Ein Eintrag ist ein Block bis zur
 * nächsten Leerzeile; seine Kennung ist der erste Name der ersten Sprachzeile.
 */
export function parseOffSynonyms(source: string): OffSynonyms {
  const result: OffSynonyms = new Map();
  let id: string | null = null;
  let de: string[] = [];
  let en: string[] = [];

  const flush = () => {
    if (id && (de.length > 0 || en.length > 0)) result.set(id, { de, en });
    id = null;
    de = [];
    en = [];
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith("#") || line.startsWith("<")) continue;
    // Namenszeilen beginnen mit einem Sprachkürzel („de: …“); Eigenschaften („allergens:en: …“),
    // stopwords und synonyms haben längere Präfixe und fallen hier heraus.
    const match = /^([a-z]{2,3}):\s*(.+)$/.exec(line);
    if (!match) continue;
    const [, language, rest] = match;
    const names = rest
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) continue;
    if (id === null) id = offSlug(language, names[0]);
    if (language === "de") de = names;
    if (language === "en") en = names;
  }
  flush();
  return result;
}

function firstAllergen(entry: OffJsonEntry): string[] {
  const value = entry.allergens?.en;
  return value
    ? value
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean)
    : [];
}

/**
 * Baut die Taxon-Datensätze aus Zutaten- und Allergen-Taxonomie. Kommt ein Code in beiden vor
 * (z. B. `en:fish`), entsteht ein Datensatz der Art ALLERGEN mit dem Baum der Zutat.
 */
export function buildOffTaxonRecords(input: {
  ingredients: OffJsonTaxonomy;
  allergens: OffJsonTaxonomy;
  synonyms?: OffSynonyms;
}): TaxonRecord[] {
  const lmiv = new Set<string>(LMIV_ALLERGEN_CODES);
  const records = new Map<string, TaxonRecord>();

  const add = (code: string, entry: OffJsonEntry, kind: TaxonRecord["kind"]) => {
    const names = entry.name ?? {};
    const synonyms = input.synonyms?.get(code);
    const existing = records.get(code);
    const nameDe = names.de ?? synonyms?.de[0] ?? null;
    const nameEn = names.en ?? synonyms?.en[0] ?? null;
    const record: TaxonRecord = {
      code,
      kind: existing?.kind === "ALLERGEN" || kind === "ALLERGEN" ? "ALLERGEN" : kind,
      source: "OFF",
      nameDe: existing?.nameDe ?? nameDe,
      nameEn: existing?.nameEn ?? nameEn,
      synonymsDe: unique([...(existing?.synonymsDe ?? []), ...(synonyms?.de ?? [])]).filter(
        (name) => name !== (existing?.nameDe ?? nameDe),
      ),
      synonymsEn: unique([...(existing?.synonymsEn ?? []), ...(synonyms?.en ?? [])]).filter(
        (name) => name !== (existing?.nameEn ?? nameEn),
      ),
      parentCodes: unique([...(existing?.parentCodes ?? []), ...(entry.parents ?? [])]),
      allergenCodes: unique([...(existing?.allergenCodes ?? []), ...firstAllergen(entry)]),
      impliesCodes: [],
      vegan: existing?.vegan ?? toTriState(entry.vegan?.en),
      vegetarian: existing?.vegetarian ?? toTriState(entry.vegetarian?.en),
      lmiv: lmiv.has(code),
    };
    records.set(code, record);
  };

  for (const [code, entry] of Object.entries(input.allergens)) {
    if (code === "en:none") continue;
    add(code, entry, "ALLERGEN");
  }
  for (const [code, entry] of Object.entries(input.ingredients)) {
    add(code, entry, "INGREDIENT");
  }

  // Eltern, die in keiner Datei vorkommen, verwerfen – sonst bricht der Baum.
  for (const record of records.values()) {
    record.parentCodes = record.parentCodes.filter((parent) => records.has(parent));
  }
  return [...records.values()];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
