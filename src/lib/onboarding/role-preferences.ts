import type { RolePreferenceDomain } from "@prisma/client";

type RolePreferenceDefinition = {
  code: string;
  domain: RolePreferenceDomain;
  title: string;
  description: string;
};

const ROLE_PREFERENCE_DEFINITIONS: Record<string, RolePreferenceDefinition> = {
  acting_statist: {
    code: "acting_statist",
    domain: "acting",
    title: "Statistenrolle",
    description: "Auf der Bühne ohne Text – Präsenz in Bildern und Szenen.",
  },
  acting_scout: {
    code: "acting_scout",
    domain: "acting",
    title: "Schnupperrolle",
    description: "Kleine Auftritte zum Reinschnuppern mit überschaubarer Textmenge.",
  },
  acting_medium: {
    code: "acting_medium",
    domain: "acting",
    title: "Mittlere Rolle",
    description:
      "Spürbar auf der Bühne, mit Verantwortung im Ensemble und regelmäßigem Proben.",
  },
  acting_lead: {
    code: "acting_lead",
    domain: "acting",
    title: "Große Rolle",
    description: "Haupt- oder zentrale Nebenrolle mit intensiver Vorbereitung und Bühnenpräsenz.",
  },
  crew_stage: {
    code: "crew_stage",
    domain: "crew",
    title: "Bühnenbild & Ausstattung",
    description: "Räume entwerfen, Kulissen bauen und für beeindruckende Bilder sorgen.",
  },
  crew_tech: {
    code: "crew_tech",
    domain: "crew",
    title: "Licht & Ton",
    description: "Shows inszenieren mit Licht, Klang, Effekten und technischer Präzision.",
  },
  crew_costume: {
    code: "crew_costume",
    domain: "crew",
    title: "Kostüm",
    description: "Looks entwickeln, nähen, Fundus pflegen und Outfits anpassen.",
  },
  crew_makeup: {
    code: "crew_makeup",
    domain: "crew",
    title: "Maske & Make-up",
    description: "Maskenbild, Styling, Perücken und schnelle Verwandlungen hinter der Bühne.",
  },
  crew_direction: {
    code: "crew_direction",
    domain: "crew",
    title: "Regieassistenz & Orga",
    description: "Abläufe koordinieren, Proben strukturieren, Teams im Hintergrund führen.",
  },
  crew_music: {
    code: "crew_music",
    domain: "crew",
    title: "Musik & Klang",
    description: "Arrangements entwickeln, Proben begleiten und Produktionen musikalisch tragen.",
  },
  crew_props: {
    code: "crew_props",
    domain: "crew",
    title: "Requisite",
    description: "Requisiten gestalten, organisieren und für reibungslose Szenen sorgen.",
  },
  crew_marketing: {
    code: "crew_marketing",
    domain: "crew",
    title: "Werbung & Social Media",
    description: "Kampagnen planen, Content erstellen und unsere Produktionen sichtbar machen.",
  },
};

const ROLE_ORDER: Record<RolePreferenceDomain, readonly string[]> = {
  acting: ["acting_statist", "acting_scout", "acting_medium", "acting_lead"],
  crew: [
    "crew_stage",
    "crew_tech",
    "crew_costume",
    "crew_makeup",
    "crew_direction",
    "crew_music",
    "crew_props",
    "crew_marketing",
  ],
};

export function listRolePreferenceDefinitions(
  domain?: RolePreferenceDomain,
): RolePreferenceDefinition[] {
  if (domain) {
    return ROLE_ORDER[domain].map((code) => ROLE_PREFERENCE_DEFINITIONS[code]);
  }
  return Object.values(ROLE_PREFERENCE_DEFINITIONS);
}

export function getRolePreferenceDefinition(code: string): RolePreferenceDefinition | undefined {
  return ROLE_PREFERENCE_DEFINITIONS[code];
}

export function isCustomRolePreference(code: string): boolean {
  return code.startsWith("custom-");
}

export function getRolePreferenceTitle(code: string): string {
  if (isCustomRolePreference(code)) {
    return "Eigenes Gewerk";
  }
  return ROLE_PREFERENCE_DEFINITIONS[code]?.title ?? code;
}

export function getRolePreferenceDescription(code: string): string | null {
  if (isCustomRolePreference(code)) {
    return "Vom Mitglied individuell ergänzt.";
  }
  return ROLE_PREFERENCE_DEFINITIONS[code]?.description ?? null;
}

