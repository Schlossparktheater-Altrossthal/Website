import { normalizeDietaryLabel } from "@/data/allergens";

/**
 * Vergleichsschlüssel für Lebensmittelnamen: wie `normalizeDietaryLabel` (Kleinschreibung,
 * Umlaute gefaltet), zusätzlich ohne Satzzeichen und Akzente. „Crème fraîche“ und „creme fraiche“
 * gelten als gleich.
 */
export function normalizeFoodText(value: string): string {
  return normalizeDietaryLabel(value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GERMAN_PLURAL_SUFFIXES = ["en", "n", "e", "s", "er"] as const;

/**
 * Schreibvarianten für die Suche: der Text selbst und einfache deutsche Singularformen
 * („Haselnusse“ → „haselnuss“, „Tomaten“ → „tomate“). Bewusst grob – die Varianten werden nur
 * gegen bekannte Namen verglichen, nie gespeichert.
 */
export function foodTextVariants(value: string): string[] {
  const base = normalizeFoodText(value);
  if (!base) return [];
  const variants = new Set([base]);
  for (const suffix of GERMAN_PLURAL_SUFFIXES) {
    if (base.length > suffix.length + 3 && base.endsWith(suffix)) {
      variants.add(base.slice(0, -suffix.length));
    }
  }
  return [...variants];
}
