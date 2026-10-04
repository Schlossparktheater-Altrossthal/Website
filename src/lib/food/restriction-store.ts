import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { linkRestrictionText } from "@/lib/food/restriction-link";
import { loadTaxonIndex } from "@/lib/food/taxonomy/store";

const logger = createLogger("food.restriction-link");

/**
 * Sicherer Taxon-Code für einen Allergie-Freitext oder `null` (ungeklärt). Fehler der Taxonomie
 * dürfen das Speichern einer Allergie nie verhindern – dann bleibt der Eintrag ungeklärt.
 */
export async function resolveRestrictionTaxonCode(text: string): Promise<string | null> {
  try {
    const index = await loadTaxonIndex();
    if (index.size === 0) return null;
    const link = linkRestrictionText(index, text);
    return link.kind === "sure" ? link.taxonCode : null;
  } catch (error) {
    logger.warn("Taxon-Zuordnung fehlgeschlagen", { error });
    return null;
  }
}

/** Verknüpft alle noch ungeklärten Einträge einer Person (nach Onboarding-Speicherungen). */
export async function linkOpenRestrictions(userId: string): Promise<void> {
  try {
    const open = await prisma.dietaryRestriction.findMany({
      where: { userId, taxonCode: null },
      select: { id: true, allergen: true },
    });
    for (const restriction of open) {
      const taxonCode = await resolveRestrictionTaxonCode(restriction.allergen);
      if (taxonCode) {
        await prisma.dietaryRestriction.update({
          where: { id: restriction.id },
          data: { taxonCode },
        });
      }
    }
  } catch (error) {
    logger.warn("Verknüpfung offener Allergien fehlgeschlagen", { error, userId });
  }
}
