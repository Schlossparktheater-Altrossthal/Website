export type ProfileChecklistItemId =
  | "basics"
  | "birthdate"
  | "dietary"
  | "measurements"
  | "photo-consent";

export type ProfileChecklistItem = {
  id: ProfileChecklistItemId;
  label: string;
  description: string;
  complete: boolean;
  targetTab?: string;
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
      targetTab: "stammdaten",
    },
    {
      id: "birthdate",
      label: "Geburtsdatum eingetragen",
      description: "Hilft bei der Verwaltung notwendiger Einverständnisse.",
      complete: input.hasBirthdate,
      targetTab: "stammdaten",
    },
    {
      id: "dietary",
      label: "Ernährungsstil gepflegt",
      description: "Informationen für Verpflegung & Eventplanung.",
      complete: input.hasDietaryPreference,
      targetTab: "ernaehrung",
    },
  ];

  if (input.hasMeasurements !== undefined) {
    items.push({
      id: "measurements",
      label: "Körpermaße hinterlegt",
      description: "Ermöglicht dem Kostüm-Team passgenaue Planung.",
      complete: Boolean(input.hasMeasurements),
      targetTab: "masse",
    });
  }

  if (input.photoConsent) {
    items.push({
      id: "photo-consent",
      label: "Fotoeinverständnis bestätigt",
      description: "Notwendig für Medienarbeit und Außendarstellung.",
      complete: Boolean(input.photoConsent.consentGiven),
      targetTab: "freigaben",
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
