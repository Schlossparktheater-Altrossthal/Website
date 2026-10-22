import { PRIVACY_POLICY_2026_11 } from "./versions/2026-11";

/** Ein Abschnitt der Datenschutzerklärung; Absätze als reiner Text, Listen als Aufzählung. */
export type PrivacySection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export type PrivacyPolicyVersion = {
  /** Stabile Kennung, wird bei Bestätigungen gespeichert (z. B. „2026-11“). */
  version: string;
  /** Ab wann die Fassung gilt (ISO-Datum). */
  validFrom: string;
  /** Wesentliche Änderung: alle müssen erneut bestätigen, sonst genügt ein Hinweis. */
  significant: boolean;
  /** Kurzfassung der Änderungen gegenüber der Vorversion, für den Bestätigungsdialog. */
  changes: string[];
  sections: PrivacySection[];
};

/** Alle Fassungen, neueste zuerst. Alte Fassungen nie löschen (Nachweis). */
export const PRIVACY_POLICY_VERSIONS: readonly PrivacyPolicyVersion[] = [PRIVACY_POLICY_2026_11];

export const CURRENT_PRIVACY_POLICY = PRIVACY_POLICY_VERSIONS[0];

/**
 * Schalter für Erklärung, Bestätigung und Einwilligungen (docs/Plan/datenschutz-plan.md).
 * Bleibt aus, bis der Vorstand des Fördervereins den Text freigegeben hat.
 */
export function isPrivacyPolicyEnabled(): boolean {
  return process.env.PRIVACY_POLICY_ENABLED?.trim() === "true";
}

export function findPrivacyPolicyVersion(version: string): PrivacyPolicyVersion | undefined {
  return PRIVACY_POLICY_VERSIONS.find((entry) => entry.version === version);
}
