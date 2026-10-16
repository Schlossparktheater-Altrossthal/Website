import type { Prisma, PrismaClient, RolePreferenceDomain } from "@prisma/client";

import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type RolePreferenceEntry = { code: string; domain: RolePreferenceDomain; weight: number };

export type ProductionPreferences = {
  preferences: RolePreferenceEntry[];
  /**
   * `null`, wenn die Wünsche zur angefragten Produktion gehören. Sonst die Produktion
   * (oder `"legacy"` für Einträge vor der Umstellung), aus der sie als Vorschlag stammen.
   */
  inheritedFrom: { showId: string; title: string | null; year: number } | "legacy" | null;
  /** Von Verantwortlichen nachgetragene Wünsche dieser Produktion (Code + Name). */
  enteredBy: { code: string; by: string }[];
};

/**
 * Rollen- und Gewerkewünsche eines Mitglieds für eine Produktion. Gibt es dort noch keine,
 * werden die zuletzt gespeicherten Wünsche (andere Produktion oder Altbestand) als
 * Vorschlag geliefert – gespeichert wird immer für die angefragte Produktion.
 */
export async function readProductionPreferences(
  userId: string,
  showId: string | null,
  db: DbClient = prisma,
): Promise<ProductionPreferences> {
  const rows = await db.memberRolePreference.findMany({
    where: { userId },
    select: {
      code: true,
      domain: true,
      weight: true,
      showId: true,
      updatedAt: true,
      show: { select: { id: true, title: true, year: true } },
      enteredBy: { select: { firstName: true, lastName: true, name: true } },
    },
    orderBy: [{ domain: "asc" }, { code: "asc" }],
  });

  const pick = (predicate: (row: (typeof rows)[number]) => boolean) =>
    rows.filter(predicate).map(({ code, domain, weight }) => ({ code, domain, weight }));

  if (showId) {
    const own = pick((row) => row.showId === showId);
    if (own.length) {
      const enteredBy = rows
        .filter((row) => row.showId === showId && row.enteredBy)
        .map((row) => ({
          code: row.code,
          by: row.enteredBy ? getUserDisplayName(row.enteredBy) : "",
        }));
      return { preferences: own, inheritedFrom: null, enteredBy };
    }
  }

  const latest = rows
    .filter((row) => row.showId !== showId)
    .reduce<(typeof rows)[number] | null>(
      (best, row) => (!best || row.updatedAt > best.updatedAt ? row : best),
      null,
    );
  if (!latest) {
    return { preferences: [], inheritedFrom: null, enteredBy: [] };
  }

  return {
    enteredBy: [],
    preferences: pick((row) => row.showId === latest.showId),
    inheritedFrom: latest.show
      ? { showId: latest.show.id, title: latest.show.title, year: latest.show.year }
      : "legacy",
  };
}

/** Ersetzt die Wünsche eines Mitglieds für genau eine Produktion. */
export async function replaceProductionPreferences(
  tx: Prisma.TransactionClient,
  userId: string,
  showId: string | null,
  preferences: ReadonlyArray<RolePreferenceEntry>,
) {
  // Nachgetragene Wünsche (Wunschliste) behalten ihre Herkunft, solange die Person sie
  // unverändert übernimmt; geänderte gelten danach als selbst angegeben.
  const previous = await tx.memberRolePreference.findMany({
    where: { userId, showId, enteredById: { not: null } },
    select: { code: true, weight: true, enteredById: true },
  });
  await tx.memberRolePreference.deleteMany({ where: { userId, showId } });
  const byCode = new Map(
    preferences.filter((pref) => pref.weight > 0).map((pref) => [pref.code, pref]),
  );
  const entries = [...byCode.values()];
  if (entries.length) {
    await tx.memberRolePreference.createMany({
      data: entries.map((pref) => ({
        userId,
        showId,
        ...pref,
        enteredById:
          previous.find((row) => row.code === pref.code && row.weight === pref.weight)
            ?.enteredById ?? null,
      })),
    });
  }
}
