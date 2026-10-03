import type { PhotoConsentLevel } from "@prisma/client";

/**
 * Stufen der Fotoerlaubnis, wie auf den Papierformularen (docs/Plan/fotoerlaubnis-stufen-plan.md).
 * Die Reihenfolge ist die Anzeigereihenfolge im Formular (großzügigste zuerst).
 */
/** Höchstlänge des Hinweisfelds. */
export const MAX_PHOTO_CONSENT_NOTE = 1000;

export const PHOTO_CONSENT_LEVELS = ["all", "promoOnRequest", "internal", "none"] as const;

export type PhotoConsentLevelValue = PhotoConsentLevel;

export type PhotoConsentLevelTone = "success" | "warning" | "info" | "destructive";

export type PhotoConsentLevelDefinition = {
  level: PhotoConsentLevelValue;
  /** Titel im Formular. */
  label: string;
  /** Kurzform für Listen und die Fotografen-Ansicht. */
  shortLabel: string;
  /** Erklärung für Volljährige („Von mir …“). */
  description: string;
  /** Erklärung für Eltern („Von meinem Kind …“). */
  descriptionMinor: string;
  tone: PhotoConsentLevelTone;
  /** Nur Volljährige können diese Stufe wählen. */
  adultOnly: boolean;
};

export const PHOTO_CONSENT_LEVEL_DEFINITIONS: Record<
  PhotoConsentLevelValue,
  PhotoConsentLevelDefinition
> = {
  all: {
    level: "all",
    label: "Alles",
    shortLabel: "Alles",
    description:
      "Aufnahmen innerhalb der Gruppe und für Programmheft, Flyer und Werbung, z. B. auf dem Instagram-Account des Theaters bzw. der Schule.",
    descriptionMinor:
      "Einzel- oder Gruppenaufnahmen innerhalb der Gruppe und für Programmheft, Flyer und Werbung, z. B. auf dem Instagram-Account des Theaters bzw. der Schule.",
    tone: "success",
    adultOnly: false,
  },
  promoOnRequest: {
    level: "promoOnRequest",
    label: "Werbung nur nach Rückfrage",
    shortLabel: "Nachfragen",
    description:
      "Aufnahmen innerhalb der Gruppe. Für Programmheft, Flyer und Werbung nur, wenn ich vorher im Einzelfall gefragt werde.",
    descriptionMinor: "",
    tone: "warning",
    adultOnly: true,
  },
  internal: {
    level: "internal",
    label: "Nur intern",
    shortLabel: "Nur intern",
    description: "Private Foto- und Filmaufnahmen, nur zur Verwendung innerhalb der Gruppe.",
    descriptionMinor: "Private Foto- und Filmaufnahmen, nur zur Verwendung innerhalb der Gruppe.",
    tone: "info",
    adultOnly: false,
  },
  none: {
    level: "none",
    label: "Gar nicht",
    shortLabel: "Gar nicht",
    description: "Es dürfen keine Aufnahmen von mir gemacht werden.",
    descriptionMinor: "Es dürfen keine Aufnahmen von meinem Kind gemacht werden.",
    tone: "destructive",
    adultOnly: false,
  },
};

export function isPhotoConsentLevel(value: unknown): value is PhotoConsentLevelValue {
  return typeof value === "string" && (PHOTO_CONSENT_LEVELS as readonly string[]).includes(value);
}

/** Stufen, die für die Zielgruppe wählbar sind. Ohne bekanntes Alter alle. */
export function photoConsentLevelsFor(isMinor: boolean | null): PhotoConsentLevelValue[] {
  return PHOTO_CONSENT_LEVELS.filter(
    (level) => !(isMinor === true && PHOTO_CONSENT_LEVEL_DEFINITIONS[level].adultOnly),
  );
}

export function isPhotoConsentLevelAllowed(
  level: PhotoConsentLevelValue,
  isMinor: boolean,
): boolean {
  return photoConsentLevelsFor(isMinor).includes(level);
}

export function photoConsentLevelLabel(level: PhotoConsentLevelValue | null): string {
  return level ? PHOTO_CONSENT_LEVEL_DEFINITIONS[level].label : "Stufe unbekannt";
}

export function photoConsentLevelShortLabel(level: PhotoConsentLevelValue | null): string {
  return level ? PHOTO_CONSENT_LEVEL_DEFINITIONS[level].shortLabel : "Unbekannt";
}

export function photoConsentLevelDescription(
  level: PhotoConsentLevelValue,
  isMinor: boolean,
): string {
  const definition = PHOTO_CONSENT_LEVEL_DEFINITIONS[level];
  return isMinor && definition.descriptionMinor
    ? definition.descriptionMinor
    : definition.description;
}

/** „Gar nicht“ ist sofort wirksam und braucht weder Nachweis noch Freigabe. */
export function photoConsentStatusForLevel(level: PhotoConsentLevelValue): "noPhotos" | "pending" {
  return level === "none" ? "noPhotos" : "pending";
}

/** Sortierung für Fotografen: restriktivste zuerst, unbekannt am Ende. */
export const PHOTO_CONSENT_LEVEL_RESTRICTION_ORDER: ReadonlyArray<PhotoConsentLevelValue | null> = [
  "none",
  "internal",
  "promoOnRequest",
  "all",
  null,
];

/**
 * Leitet die Stufe aus den Codes der angekreuzten Zwecke des alten Katalogs ab (gleiche Regeln
 * wie die Migration 20261004000000_photo_consent_levels). Ohne erkennbare Auswahl `null`.
 */
export function photoConsentLevelFromPurposeCodes(
  chosenCodes: readonly string[],
  status?: string | null,
): PhotoConsentLevelValue | null {
  const codes = new Set(chosenCodes);
  if (status === "noPhotos" || codes.has("none")) return "none";
  if (codes.has("promo")) return "all";
  if (codes.has("promo_on_request")) return "promoOnRequest";
  if (codes.has("internal")) return "internal";
  return null;
}

/**
 * Hat das Mitglied seinen Teil erledigt? Freigegeben, „gar nicht“ oder abgegeben mit Nachweis
 * (wartet nur noch auf die Prüfung). Fehlender Nachweis oder Ablehnung bleibt offen.
 */
export function isPhotoConsentDone(
  consent: {
    status: string;
    hasProof: boolean;
  } | null,
): boolean {
  if (!consent) return false;
  if (consent.status === "approved" || consent.status === "noPhotos") return true;
  return consent.status === "pending" && consent.hasProof;
}
