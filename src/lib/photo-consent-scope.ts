import type { Prisma } from "@prisma/client";

import { getActiveProductionId } from "@/lib/active-production";

/**
 * Fotoerlaubnisse gelten pro Produktion. Für Mitglieder zählt die Produktion, die
 * ihnen gerade angezeigt wird (aktive Produktion bzw. ihre aktuelle Mitgliedschaft).
 */
export async function resolvePhotoConsentShowId(userId: string): Promise<string | null> {
  return getActiveProductionId(userId);
}

/** Relation-Select für die Fotoerlaubnis einer Produktion (höchstens ein Eintrag). */
export function photoConsentsForShow<S extends Prisma.PhotoConsentSelect>(
  showId: string | null,
  select: S,
) {
  const where: Prisma.PhotoConsentWhereInput = showId
    ? { showId, revokedAt: null }
    : { id: { in: [] } };
  return { where, take: 1, select };
}

export function firstConsent<T>(consents: readonly T[] | null | undefined): T | null {
  return consents?.[0] ?? null;
}
