import type { Prisma } from "@prisma/client";

import { getActiveProductionId } from "@/lib/active-production";
import { prisma } from "@/lib/prisma";
import type { PhotoConsentPrevious } from "@/types/photo-consent";

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
  options?: { includeRevoked?: boolean },
) {
  const where: Prisma.PhotoConsentWhereInput = showId
    ? { showId, ...(options?.includeRevoked ? {} : { revokedAt: null }) }
    : { id: { in: [] } };
  return { where, take: 1, select };
}

export function firstConsent<T>(consents: readonly T[] | null | undefined): T | null {
  return consents?.[0] ?? null;
}

/**
 * Letzte Fotoerlaubnis mit bekannter Stufe aus einer anderen Produktion. Dient Volljährigen
 * zum Vorausfüllen; die Unterschrift muss trotzdem neu geleistet werden.
 */
export async function loadPreviousPhotoConsent(
  userId: string,
  showId: string | null,
): Promise<PhotoConsentPrevious | null> {
  const previous = await prisma.photoConsent.findFirst({
    where: {
      userId,
      revokedAt: null,
      level: { not: null },
      status: { in: ["approved", "noPhotos", "pending"] },
      ...(showId ? { showId: { not: showId } } : {}),
    },
    orderBy: [{ show: { year: "desc" } }, { updatedAt: "desc" }],
    select: { level: true, exclusionNote: true, show: { select: { title: true, year: true } } },
  });
  if (!previous?.level) {
    return null;
  }
  return {
    showTitle: previous.show.title ?? `Produktion ${previous.show.year}`,
    level: previous.level,
    exclusionNote: previous.exclusionNote ?? null,
  };
}
