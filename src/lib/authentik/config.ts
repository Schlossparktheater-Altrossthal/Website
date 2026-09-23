/**
 * Konfiguration der Authentik-Anbindung (Single Sign-on).
 *
 * Authentik (auth.sommertheater-altrossthal.de) übernimmt die Anmeldung, der
 * Mitgliederbereich bleibt Quelle der Wahrheit für Mitglieder und Rechte. Ohne
 * gesetzte Variablen läuft der Mitgliederbereich wie bisher nur mit dem lokalen
 * Passwort-Login (z. B. in der lokalen Entwicklung).
 */

export const AUTHENTIK_PROVIDER_ID = "authentik";

/** Pfad der vom Mitgliederbereich verwalteten Konten in Authentik. */
export const AUTHENTIK_MANAGED_USER_PATH = "mitgliederbereich";

/**
 * Kurzlebiges Cookie mit dem Onboarding-Token, damit deaktivierte Rückkehrer
 * auch beim Login über Authentik wieder aktiviert werden.
 */
export const ONBOARDING_TOKEN_COOKIE = "theater-onboarding-token";

const DEFAULT_RECOVERY_EMAIL_STAGE = "theater-recovery-email";

export type AuthentikOidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
};

export type AuthentikApiConfig = {
  /** Öffentliche Basis-URL, z. B. https://auth.sommertheater-altrossthal.de */
  baseUrl: string;
  token: string;
  recoveryEmailStage: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getAuthentikOidcConfig(): AuthentikOidcConfig | null {
  const issuer = readEnv("AUTHENTIK_ISSUER");
  const clientId = readEnv("AUTHENTIK_CLIENT_ID");
  const clientSecret = readEnv("AUTHENTIK_CLIENT_SECRET");
  if (!issuer || !clientId || !clientSecret) return null;
  return { issuer, clientId, clientSecret };
}

/**
 * API-Zugang (Service-Account "mitgliederbereich-api"). Die Basis-URL ist
 * bewusst die öffentliche Domain: Authentik wählt Brand und Recovery-Flow
 * anhand des Hosts der Anfrage.
 */
export function getAuthentikApiConfig(): AuthentikApiConfig | null {
  const token = readEnv("AUTHENTIK_API_TOKEN");
  const explicitBase = readEnv("AUTHENTIK_URL");
  const issuer = readEnv("AUTHENTIK_ISSUER");
  let baseUrl = explicitBase;
  if (!baseUrl && issuer) {
    try {
      baseUrl = new URL(issuer).origin;
    } catch (error) {
      console.error("[authentik] AUTHENTIK_ISSUER ist keine gültige URL", error);
    }
  }
  if (!token || !baseUrl) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
    recoveryEmailStage: readEnv("AUTHENTIK_RECOVERY_EMAIL_STAGE") ?? DEFAULT_RECOVERY_EMAIL_STAGE,
  };
}

/** SSO ist aktiv, sobald OIDC-Client und API-Zugang konfiguriert sind. */
export function isAuthentikEnabled(): boolean {
  return getAuthentikOidcConfig() !== null && getAuthentikApiConfig() !== null;
}

/**
 * ÜBERGANGSPHASE (befristet): Bis zu diesem Stichtag funktioniert der alte
 * Passwort-Login weiter und überträgt das Passwort bei Erfolg nach Authentik.
 * Danach ist nur noch die Anmeldung über Authentik möglich; Mitglieder ohne
 * migriertes Passwort setzen es per "Passwort vergessen" neu.
 *
 * Wenn der Stichtag vorbei ist, können entfernt werden: der Credentials-Login
 * in `src/auth.ts`, `src/lib/authentik/migration.ts`, die Spalte
 * `User.passwordHash` und diese Funktion.
 */
export function getLegacyPasswordLoginDeadline(): Date | null {
  const raw = readEnv("AUTHENTIK_LEGACY_LOGIN_UNTIL");
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) {
    console.warn(`[authentik] AUTHENTIK_LEGACY_LOGIN_UNTIL ist kein gültiges Datum: ${raw}`);
    return null;
  }
  return parsed;
}

/**
 * Ohne Authentik bleibt der Passwort-Login dauerhaft aktiv. Mit Authentik gilt
 * er nur bis zum Stichtag (ohne Stichtag unbefristet, bis einer gesetzt wird).
 */
export function isLegacyPasswordLoginActive(now: Date = new Date()): boolean {
  if (!isAuthentikEnabled()) return true;
  const deadline = getLegacyPasswordLoginDeadline();
  return !deadline || now < deadline;
}
