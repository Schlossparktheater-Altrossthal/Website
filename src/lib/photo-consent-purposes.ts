import type { PhotoConsentPurpose, PhotoConsentPurposeAudience } from "@prisma/client";

import { DEFAULT_PHOTO_CONSENT_PURPOSES } from "@/data/photo-consent-purposes";
import { prisma } from "@/lib/prisma";

export type PhotoConsentAudience = "adult" | "minor";

/** Ermittelt die Zielgruppe aus dem Alter. Ohne Geburtsdatum ist sie unbekannt. */
export function resolvePhotoConsentAudience(age: number | null): PhotoConsentAudience | null {
  if (age === null) return null;
  return age < 18 ? "minor" : "adult";
}

export function purposeAppliesToAudience(
  appliesTo: PhotoConsentPurposeAudience,
  audience: PhotoConsentAudience,
): boolean {
  return appliesTo === "both" || appliesTo === audience;
}

/**
 * Legt die Standard-Zwecke für eine Produktion an, wenn dort noch keine existieren.
 * Zwecke werden in der Verwaltung deaktiviert, nicht gelöscht, damit die Liste nie leer wird.
 */
export async function ensurePhotoConsentPurposes(showId: string): Promise<void> {
  const existing = await prisma.photoConsentPurpose.count({ where: { showId } });
  if (existing > 0) {
    return;
  }

  await prisma.photoConsentPurpose.createMany({
    data: DEFAULT_PHOTO_CONSENT_PURPOSES.map((purpose, index) => ({
      showId,
      code: purpose.code,
      label: purpose.label,
      description: purpose.description,
      sortOrder: index,
      appliesTo: purpose.appliesTo,
      isRefusal: purpose.isRefusal,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

/**
 * Lädt die Zwecke einer Produktion, optional gefiltert nach Zielgruppe. Ohne aktive Zwecke
 * werden vorher die Standard-Zwecke angelegt.
 */
export async function listPhotoConsentPurposes(
  showId: string,
  audience?: PhotoConsentAudience | null,
): Promise<PhotoConsentPurpose[]> {
  await ensurePhotoConsentPurposes(showId);

  const purposes = await prisma.photoConsentPurpose.findMany({
    where: { showId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (!audience) {
    return purposes;
  }

  return purposes.filter((purpose) => purposeAppliesToAudience(purpose.appliesTo, audience));
}
