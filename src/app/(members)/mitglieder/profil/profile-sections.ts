import type { ProfileChecklistTarget } from "@/lib/profile-completion";

export type ProfileSectionId = ProfileChecklistTarget;

export type ProfileSectionDefinition = {
  id: ProfileSectionId;
  label: string;
  description: string;
  group: "person" | "production";
};

/** Reihenfolge und Texte der Profilbereiche (`/mitglieder/profil?bereich=<id>`). */
export const PROFILE_SECTIONS: readonly ProfileSectionDefinition[] = [
  {
    id: "stammdaten",
    label: "Persönliche Daten",
    description: "Name, Geburtsdatum, Profilbild und Zugang.",
    group: "person",
  },
  {
    id: "zahlungen",
    label: "Zahlungsdaten",
    description: "Für Erstattungen von Auslagen.",
    group: "person",
  },
  {
    id: "ernaehrung",
    label: "Ernährung & Allergien",
    description: "Damit die Verpflegung bei Proben und Aufführungen für alle passt.",
    group: "person",
  },
  {
    id: "freigaben",
    label: "Fotoerlaubnis",
    description: "Ob wir Fotos von Proben und Aufführungen mit dir zeigen dürfen.",
    group: "person",
  },
  {
    id: "interessen",
    label: "Interessen",
    description: "Was dir Spaß macht – hilft bei der Einteilung in Teams.",
    group: "person",
  },
  {
    id: "produktion",
    label: "Meine Produktion",
    description: "Rollen- und Gewerkewünsche, Hintergrund und Team-Chat.",
    group: "production",
  },
];

export const PROFILE_SECTION_GROUP_LABELS: Record<ProfileSectionDefinition["group"], string> = {
  person: "Über mich",
  production: "Produktion",
};

export function resolveProfileSection(value: string | null | undefined): ProfileSectionId | null {
  if (!value) return null;
  // Alte Links auf die frühere Tab-Struktur weiterhin auflösen.
  const normalized = value === "onboarding" || value === "rollen" ? "produktion" : value;
  return PROFILE_SECTIONS.find((section) => section.id === normalized)?.id ?? null;
}

export function getProfileSectionHref(section: ProfileSectionId) {
  return `/mitglieder/profil?bereich=${section}`;
}
