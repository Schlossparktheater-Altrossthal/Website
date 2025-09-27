export type ProfileChecklistItemId =
  | "basics"
  | "birthdate"
  | "dietary"
  | "measurements"
  | "photo-consent"
  | "whatsapp";

export type ProfileChecklistTarget =
  | "stammdaten"
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
