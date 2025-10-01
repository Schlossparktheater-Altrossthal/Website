import type { PayoutMethod } from "@prisma/client";

export type ProfileChecklistItemId =
  | "basics"
  | "birthdate"
  | "dietary"
  | "payout"
  | "measurements"
  | "photo-consent"
  | "whatsapp";

export type ProfileChecklistTarget =
  | "stammdaten"
  | "zahlungen"
  | "ernaehrung"
  | "masse"
  | "interessen"
  | "freigaben"
  | "onboarding";

export type ProfileChecklistItem = {
  id: ProfileChecklistItemId;
  label: string;
  description: string;
  complete: boolean;
  targetSection?: ProfileChecklistTarget;
};

export type ProfileCompletionSummary = {
  items: ProfileChecklistItem[];
  completed: number;
  total: number;
  complete: boolean;
};

type ChecklistInput = {
  hasBasicData: boolean;
  hasBirthdate: boolean;
  hasDietaryPreference: boolean;
  hasPayoutDetails?: boolean;
  hasMeasurements?: boolean;
  photoConsent?: { consentGiven: boolean };
  hasWhatsappVisit?: boolean;
};

export function buildProfileChecklist(
  input: ChecklistInput,
): ProfileCompletionSummary {
  const items: ProfileChecklistItem[] = [
    {
      id: "basics",
      label: "Stammdaten aktualisiert",
      description: "Vorname, Nachname und Kontaktadresse hinterlegt.",
      complete: input.hasBasicData,
      targetSection: "stammdaten",
    },
    {
      id: "birthdate",
      label: "Geburtsdatum eingetragen",
      description: "Hilft bei der Verwaltung notwendiger Einverständnisse.",
      complete: input.hasBirthdate,
      targetSection: "stammdaten",
    },
    {
      id: "dietary",
      label: "Ernährungsstil gepflegt",
      description: "Informationen für Verpflegung & Eventplanung.",
      complete: input.hasDietaryPreference,
      targetSection: "ernaehrung",
    },
  ];

  if (input.hasPayoutDetails !== undefined) {
    items.push({
      id: "payout",
      label: "Zahlungsdaten hinterlegt",
      description: "Stellt reibungslose Erstattungen und Auszahlungen sicher.",
      complete: Boolean(input.hasPayoutDetails),
      targetSection: "zahlungen",
    });
  }

  if (input.hasMeasurements !== undefined) {
    items.push({
      id: "measurements",
      label: "Körpermaße hinterlegt",
      description: "Ermöglicht dem Kostüm-Team passgenaue Planung.",
      complete: Boolean(input.hasMeasurements),
      targetSection: "masse",
    });
  }

  if (input.hasWhatsappVisit !== undefined) {
    items.push({
      id: "whatsapp",
      label: "WhatsApp-Infokanal bestätigt",
      description: "Bestätige den Zugriff auf unseren WhatsApp-Infokanal.",
      complete: Boolean(input.hasWhatsappVisit),
      targetSection: "onboarding",
    });
  }

  if (input.photoConsent) {
    items.push({
      id: "photo-consent",
      label: "Fotoeinverständnis bestätigt",
      description: "Notwendig für Medienarbeit und Außendarstellung.",
      complete: Boolean(input.photoConsent.consentGiven),
      targetSection: "freigaben",
    });
  }

  const total = items.length;
  const completed = items.filter((item) => item.complete).length;

  return {
    items,
    completed,
    total,
    complete: completed === total,
  };
}

type PayoutDetailsInput = {
  method: PayoutMethod | null | undefined;
  accountHolder?: string | null;
  iban?: string | null;
  bankName?: string | null;
  paypalHandle?: string | null;
  note?: string | null;
};

function hasFilledValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function isPayoutDetailsComplete(input: PayoutDetailsInput): boolean {
  if (!input.method) {
    return false;
  }

  if (input.method === "BANK_TRANSFER") {
    return (
      hasFilledValue(input.accountHolder) &&
      hasFilledValue(input.iban) &&
      hasFilledValue(input.bankName)
    );
  }

  if (input.method === "PAYPAL") {
    return hasFilledValue(input.paypalHandle);
  }

  if (input.method === "OTHER") {
    return hasFilledValue(input.note);
  }

  return false;
}
