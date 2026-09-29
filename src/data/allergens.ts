import { RestrictionKind } from "@prisma/client";

/**
 * Anzeigetexte der Eintragsart. Die Werte kommen aus dem Prisma-Enum `RestrictionKind`.
 */
export const ALLERGEN_KIND_LABELS: Record<RestrictionKind, string> = {
  ALLERGY: "Allergie",
  INTOLERANCE: "Unverträglichkeit",
  OTHER: "Sonstiges",
};

export const ALLERGEN_KIND_OPTIONS: readonly { value: RestrictionKind; label: string }[] =
  Object.values(RestrictionKind).map((value) => ({ value, label: ALLERGEN_KIND_LABELS[value] }));

export type AllergenCatalogEntry = {
  value: string;
  /** Anzeigetext und zugleich der Text, der als Allergen gespeichert wird. */
  label: string;
  kind: RestrictionKind;
  /** Schreibweisen und Oberbegriffe, unter denen das Allergen gesucht wird. */
  aliases: readonly string[];
};

/**
 * Vorschlagsliste für das Allergen-Feld. Sie ist ausdrücklich ein Vorschlag: Freitext bleibt
 * möglich, weil keine Liste alle Sonderfälle kennt.
 *
 * Grundlage sind die vierzehn kennzeichnungspflichtigen Allergene (LMIV Anhang II, in der Schweiz
 * LGV), danach häufige Intoleranzen und sonstige Angaben. Die Art wird beim Auswählen vorbelegt,
 * lässt sich aber ändern: Milcheiweiß ist eine Allergie, Milchzucker eine Intoleranz.
 */
export const ALLERGEN_CATALOG: readonly AllergenCatalogEntry[] = [
  {
    value: "gluten",
    label: "Gluten",
    kind: "ALLERGY",
    aliases: ["Weizen", "Dinkel", "Roggen", "Gerste", "Hafer", "Zöliakie"],
  },
  {
    value: "crustaceans",
    label: "Krebstiere",
    kind: "ALLERGY",
    aliases: ["Garnele", "Krabbe", "Hummer", "Krebs"],
  },
  { value: "eggs", label: "Eier", kind: "ALLERGY", aliases: ["Ei", "Hühnerei", "Eiklar"] },
  { value: "fish", label: "Fisch", kind: "ALLERGY", aliases: ["Fischeiweiß"] },
  { value: "peanuts", label: "Erdnüsse", kind: "ALLERGY", aliases: ["Erdnuss"] },
  { value: "soy", label: "Soja", kind: "ALLERGY", aliases: ["Sojabohne"] },
  {
    value: "milk-protein",
    label: "Milcheiweiß",
    kind: "ALLERGY",
    aliases: ["Kuhmilch", "Milchallergie", "Molke"],
  },
  {
    value: "tree-nuts",
    label: "Schalenfrüchte",
    kind: "ALLERGY",
    aliases: ["Nüsse", "Walnuss", "Haselnuss", "Mandel", "Cashew", "Pistazie", "Pekannuss"],
  },
  {
    value: "celery",
    label: "Sellerie",
    kind: "ALLERGY",
    aliases: ["Knollensellerie", "Staudensellerie"],
  },
  { value: "mustard", label: "Senf", kind: "ALLERGY", aliases: ["Senfkörner"] },
  { value: "sesame", label: "Sesam", kind: "ALLERGY", aliases: ["Sesamsamen"] },
  {
    value: "sulphites",
    label: "Sulfite",
    kind: "ALLERGY",
    aliases: ["Schwefeldioxid", "Sulfit"],
  },
  { value: "lupin", label: "Lupinen", kind: "ALLERGY", aliases: ["Lupine"] },
  {
    value: "molluscs",
    label: "Weichtiere",
    kind: "ALLERGY",
    aliases: ["Muschel", "Tintenfisch", "Schnecke", "Auster"],
  },
  {
    value: "lactose",
    label: "Laktose",
    kind: "INTOLERANCE",
    aliases: ["Milchzucker", "Laktoseintoleranz"],
  },
  {
    value: "fructose",
    label: "Fruktose",
    kind: "INTOLERANCE",
    aliases: ["Fruchtzucker", "Fruktoseintoleranz"],
  },
  { value: "histamine", label: "Histamin", kind: "INTOLERANCE", aliases: ["Histaminintoleranz"] },
  {
    value: "sorbitol",
    label: "Sorbit",
    kind: "INTOLERANCE",
    aliases: ["Sorbitintoleranz", "Zuckeraustauschstoffe"],
  },
  {
    value: "cross-allergy",
    label: "Kreuzallergie",
    kind: "ALLERGY",
    aliases: ["Pollenallergie", "Birkenpollen", "Haselpollen", "orale Allergie"],
  },
  {
    value: "insect-venom",
    label: "Insektengift",
    kind: "ALLERGY",
    aliases: ["Bienenstich", "Wespenstich", "Biene", "Wespe"],
  },
  {
    value: "medication",
    label: "Medikamente",
    kind: "ALLERGY",
    aliases: ["Penicillin", "Antibiotika"],
  },
  { value: "latex", label: "Latex", kind: "ALLERGY", aliases: ["Naturlatex"] },
  {
    value: "additives",
    label: "Zusatzstoffe",
    kind: "OTHER",
    aliases: ["Konservierungsstoffe", "Farbstoffe", "Geschmacksverstärker"],
  },
  { value: "alcohol", label: "Alkohol", kind: "OTHER", aliases: ["Alkoholunverträglichkeit"] },
];

const UMLAUT_FOLDING: Record<string, string> = { ä: "a", ö: "o", ü: "u", ß: "ss" };

/**
 * Vergleichsschlüssel für Ernährungsangaben: Groß-/Kleinschreibung, mehrfache Leerzeichen und
 * Umlaute fallen weg. Damit gelten „Erdnüsse", „erdnüsse" und „erdnuss" als derselbe Eintrag –
 * so, wie Menschen tippen.
 */
export function normalizeDietaryLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE")
    .replace(/[äöüß]/g, (character) => UMLAUT_FOLDING[character] ?? character);
}

/**
 * Sucht einen Katalogeintrag zu einem bereits bekannten Text – auch über die Aliase. Damit wird
 * die Art vorbelegt, wenn jemand ein Allergen tippt, ohne es aus der Liste zu wählen.
 */
export function findAllergenEntry(input: string): AllergenCatalogEntry | null {
  const normalized = normalizeDietaryLabel(input);
  if (!normalized) {
    return null;
  }
  return (
    ALLERGEN_CATALOG.find((entry) => {
      if (normalizeDietaryLabel(entry.label) === normalized) {
        return true;
      }
      return entry.aliases.some((alias) => normalizeDietaryLabel(alias) === normalized);
    }) ?? null
  );
}

/** Art (Allergie/Intoleranz/Sonstiges) zu einem bekannten Allergen-Text, sonst `null`. */
export function resolveAllergenKind(input: string): RestrictionKind | null {
  return findAllergenEntry(input)?.kind ?? null;
}

/**
 * Vorschläge zum bisher getippten Text. Eigene Treffer nach Label stehen vor Alias-Treffern,
 * genaue Treffer vor Präfix- und Teilworttreffern.
 */
export function suggestAllergens(query: string, limit = 8): AllergenCatalogEntry[] {
  const normalized = normalizeDietaryLabel(query);
  if (!normalized) {
    return [];
  }

  const scored: { entry: AllergenCatalogEntry; score: number }[] = [];
  for (const entry of ALLERGEN_CATALOG) {
    const terms = [normalizeDietaryLabel(entry.label), ...entry.aliases.map(normalizeDietaryLabel)];
    let score = -1;
    for (const term of terms) {
      if (term === normalized) {
        score = Math.max(score, 0);
      } else if (term.startsWith(normalized)) {
        score = Math.max(score, 1);
      } else if (term.includes(normalized)) {
        score = Math.max(score, 2);
      }
    }
    if (score >= 0) {
      scored.push({ entry, score });
    }
  }

  return scored
    .sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label, "de"))
    .slice(0, limit)
    .map((item) => item.entry);
}
