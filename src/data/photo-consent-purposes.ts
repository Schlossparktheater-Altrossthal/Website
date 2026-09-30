import type { PhotoConsentPurposeAudience } from "@prisma/client";

export type PhotoConsentPurposeDefinition = {
  code: string;
  label: string;
  description: string | null;
  appliesTo: PhotoConsentPurposeAudience;
  isRefusal: boolean;
};

/**
 * Standard-Zwecke der Fotoerlaubnis, abgeleitet aus den beiden PDF-Vorlagen
 * („Einverständniserklärung Theater“ und „Einverständniserklärung Ü18“).
 *
 * Die Reihenfolge bestimmt die Sortierung. „Werbung mit Einverständnis auf Nachfrage“
 * gibt es nur in der Ü18-Vorlage, deshalb `appliesTo: "adult"`.
 */
export const DEFAULT_PHOTO_CONSENT_PURPOSES: readonly PhotoConsentPurposeDefinition[] = [
  {
    code: "internal",
    label: "Private Foto- und Filmaufnahmen",
    description: "Verwendung innerhalb der Gruppe.",
    appliesTo: "both",
    isRefusal: false,
  },
  {
    code: "promo",
    label: "Programmheft, Flyer und Werbung",
    description:
      "Aufnahmen für Programmheft/Flyer oder für Werbezwecke, z. B. auf dem Instagram-Account des Theaters bzw. der Schule.",
    appliesTo: "both",
    isRefusal: false,
  },
  {
    code: "promo_on_request",
    label: "Werbung mit Einverständnis auf Nachfrage",
    description:
      "Wie oben, aber nur mit Einverständnis auf Nachfrage. Nur in der Volljährigen-Vorlage enthalten.",
    appliesTo: "adult",
    isRefusal: false,
  },
  {
    code: "none",
    label: "Gar nicht",
    description: "Keine Aufnahmen erlaubt.",
    appliesTo: "both",
    isRefusal: true,
  },
];

/** Schlüssel des Ablehnungs-Zwecks („gar nicht“). */
export const REFUSAL_PURPOSE_CODE = "none";
