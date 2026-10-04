import { normalizeDietaryLabel } from "@/data/allergens";
import { normalizeFoodText } from "@/lib/food/normalize";
import { linkRestrictionText } from "@/lib/food/restriction-link";
import { resolveRestrictionTaxonCode } from "@/lib/food/restriction-store";
import { splitAllergenList } from "@/lib/food/split-list";
import { suggestTaxa, type TaxonSuggestion } from "@/lib/food/taxon-suggestions";
import { invalidateTaxonIndex, loadTaxonIndex } from "@/lib/food/taxonomy/store";
import { prisma } from "@/lib/prisma";

/**
 * Pflegeliste ungeklärter Allergie-Angaben (docs/Plan/ernaehrung-rezepte-ui-plan.md, Phase 3).
 * Gezeigt werden nur Texte und Anzahlen, keine Namen – für die Zuordnung reicht der Text.
 * Jede Zuordnung wird als bestätigter Alias gespeichert und gilt danach automatisch.
 */

export type PendingRestrictionGroup = {
  /** Vergleichsschlüssel (Kleinschreibung, Umlaute gefaltet). */
  key: string;
  text: string;
  count: number;
  /** Sammeleintrag, der sich aufteilen lässt. */
  parts: string[];
  suggestions: TaxonSuggestion[];
};

export async function listPendingRestrictions(): Promise<PendingRestrictionGroup[]> {
  const [rows, index] = await Promise.all([
    prisma.dietaryRestriction.findMany({
      where: { taxonCode: null, isActive: true },
      select: { allergen: true },
    }),
    loadTaxonIndex(),
  ]);
  const groups = new Map<string, { text: string; count: number }>();
  for (const row of rows) {
    const key = normalizeDietaryLabel(row.allergen);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { text: row.allergen, count: 1 });
  }
  return [...groups.entries()]
    .map(([key, { text, count }]) => {
      const link = linkRestrictionText(index, text);
      const linked =
        link.kind === "suggestion" ? link.taxonCodes : link.kind === "sure" ? [link.taxonCode] : [];
      const fromLink = linked.flatMap((code) =>
        suggestTaxa(index, index.get(code)?.nameDe ?? code, 1).filter((item) => item.code === code),
      );
      // Sicherer Treffer: nur diesen anbieten (ein Klick bestätigt), sonst zusätzlich die Suche.
      const fromSearch = link.kind === "sure" ? [] : suggestTaxa(index, text, 4);
      const suggestions = [
        ...new Map([...fromLink, ...fromSearch].map((s) => [s.code, s])).values(),
      ];
      return {
        key,
        text,
        count,
        parts: splitAllergenList(text),
        suggestions: suggestions.slice(0, 5),
      };
    })
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "de"));
}

async function rowsForKey(key: string) {
  const rows = await prisma.dietaryRestriction.findMany({
    where: { taxonCode: null, isActive: true },
  });
  return rows.filter((row) => normalizeDietaryLabel(row.allergen) === key);
}

/** Ordnet alle ungeklärten Einträge mit diesem Text einem Taxon zu und merkt sich den Text. */
export async function assignPendingRestriction(
  key: string,
  taxonCode: string,
  userId: string,
): Promise<number> {
  const index = await loadTaxonIndex();
  if (!index.has(taxonCode)) throw new Error("Unbekannter Eintrag in der Taxonomie.");
  const rows = await rowsForKey(key);
  if (rows.length === 0) return 0;

  const aliasText = normalizeFoodText(rows[0].allergen);
  await prisma.$transaction([
    prisma.dietaryRestriction.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { taxonCode },
    }),
    prisma.foodTaxonAlias.upsert({
      where: { text: aliasText },
      create: { text: aliasText, taxonCode, source: "CONFIRMED", createdById: userId },
      update: { taxonCode, source: "CONFIRMED", createdById: userId },
    }),
  ]);
  invalidateTaxonIndex();
  return rows.length;
}

/**
 * Teilt Sammeleinträge („Erdnüsse, rote Beete“) je Person in einzelne Einträge mit denselben
 * Details auf; jeder Teil wird sofort automatisch zugeordnet, soweit möglich.
 */
export async function splitPendingRestriction(key: string): Promise<number> {
  const rows = await rowsForKey(key);
  let created = 0;
  for (const row of rows) {
    const parts = splitAllergenList(row.allergen);
    if (parts.length < 2) continue;
    const existing = new Set(
      (
        await prisma.dietaryRestriction.findMany({
          where: { userId: row.userId },
          select: { allergen: true },
        })
      ).map((entry) => normalizeDietaryLabel(entry.allergen)),
    );
    const details = {
      kind: row.kind,
      level: row.level,
      tracesOk: row.tracesOk,
      diagnosed: row.diagnosed,
      symptoms: row.symptoms,
      treatment: row.treatment,
      note: row.note,
      isActive: true,
    };
    const fresh = parts.filter((part) => !existing.has(normalizeDietaryLabel(part)));
    const codes = await Promise.all(fresh.map((part) => resolveRestrictionTaxonCode(part)));
    await prisma.$transaction([
      ...fresh.map((part, position) =>
        prisma.dietaryRestriction.create({
          data: { userId: row.userId, allergen: part, taxonCode: codes[position], ...details },
        }),
      ),
      prisma.dietaryRestriction.delete({ where: { id: row.id } }),
    ]);
    created += fresh.length;
  }
  return created;
}

/** Entfernt Einträge ohne Aussage („Keine“, „Nichts“). */
export async function deletePendingRestriction(key: string): Promise<number> {
  const rows = await rowsForKey(key);
  const result = await prisma.dietaryRestriction.deleteMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });
  return result.count;
}
