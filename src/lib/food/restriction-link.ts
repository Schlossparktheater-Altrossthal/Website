import { findAllergenEntry, normalizeDietaryLabel } from "@/data/allergens";
import { CATALOG_VALUE_TO_TAXON } from "@/lib/food/taxonomy/custom";
import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";

/**
 * Freitext einer Allergie/Unverträglichkeit → Taxon (docs/Plan/lebensmittel-standard-plan.md).
 *
 * `sure`: Katalogeintrag, bestätigter Alias oder genauer Name – darf automatisch gesetzt werden.
 * `suggestion`: nur Wortteil-Treffer – braucht eine Bestätigung (Migration, Pflegeliste).
 */
export type RestrictionLink =
  | { kind: "sure"; taxonCode: string; via: "catalog" | "name" }
  | { kind: "suggestion"; taxonCodes: string[] }
  | { kind: "none" };

export function linkRestrictionText(index: TaxonIndex, text: string): RestrictionLink {
  // Reihenfolge: Katalogname („Erdnüsse“) → genauer Taxonomie-Name („Haselnuss“ bleibt Haselnuss
  // statt aller Schalenfrüchte) → Katalog-Alias.
  const catalog = findAllergenEntry(text);
  const catalogTaxon = catalog ? CATALOG_VALUE_TO_TAXON[catalog.value] : undefined;
  const usableCatalog = catalogTaxon && index.has(catalogTaxon) ? catalogTaxon : null;
  if (
    usableCatalog &&
    catalog &&
    normalizeDietaryLabel(catalog.label) === normalizeDietaryLabel(text)
  ) {
    return { kind: "sure", taxonCode: usableCatalog, via: "catalog" };
  }
  const exact = index.matchExact(text);
  if (exact) return { kind: "sure", taxonCode: exact.code, via: "name" };
  if (usableCatalog) return { kind: "sure", taxonCode: usableCatalog, via: "catalog" };
  const partial = index.matchText(text).map((match) => match.code);
  return partial.length > 0 ? { kind: "suggestion", taxonCodes: partial } : { kind: "none" };
}
