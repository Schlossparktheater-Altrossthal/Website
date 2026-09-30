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

/** Benannte Vorlage für den Zweck-Katalog einer Produktion. */
export type PhotoConsentPurposeTemplate = {
  code: string;
  label: string;
  description: string;
  purposes: readonly PhotoConsentPurposeDefinition[];
};

/**
 * Vorlagen für den Zweck-Katalog. „Standard“ entspricht den bisherigen Standard-Zwecken.
 * Vorlagen ersetzen den Katalog einer Produktion: nicht enthaltene Zwecke werden deaktiviert,
 * bestehende Auswahlen bleiben nachvollziehbar erhalten.
 */
export const PHOTO_CONSENT_PURPOSE_TEMPLATES: readonly PhotoConsentPurposeTemplate[] = [
  {
    code: "standard",
    label: "Standard",
    description: "Private Aufnahmen, Programmheft und Werbung, Werbung auf Nachfrage, Ablehnung.",
    purposes: DEFAULT_PHOTO_CONSENT_PURPOSES,
  },
  {
    code: "nur-intern",
    label: "Nur intern",
    description: "Nur private Aufnahmen innerhalb der Gruppe plus Ablehnung – keine Werbung.",
    purposes: [
      DEFAULT_PHOTO_CONSENT_PURPOSES[0],
      {
        code: "none",
        label: "Gar nicht",
        description: "Keine Aufnahmen erlaubt.",
        appliesTo: "both",
        isRefusal: true,
      },
    ],
  },
  {
    code: "ohne-social",
    label: "Ohne Social Media",
    description: "Private Aufnahmen und Programmheft/Werbung, aber ohne die Werbung auf Nachfrage.",
    purposes: [
      DEFAULT_PHOTO_CONSENT_PURPOSES[0],
      DEFAULT_PHOTO_CONSENT_PURPOSES[1],
      {
        code: "none",
        label: "Gar nicht",
        description: "Keine Aufnahmen erlaubt.",
        appliesTo: "both",
        isRefusal: true,
      },
    ],
  },
];
