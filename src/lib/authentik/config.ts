/**
 * Konfiguration der Authentik-Anbindung (Single Sign-on).
 *
 * Authentik (auth.sommertheater-altrossthal.de) übernimmt die Anmeldung, der
 * Mitgliederbereich bleibt Quelle der Wahrheit für Mitglieder und Rechte. Ohne
 * gesetzte Variablen läuft der Mitgliederbereich wie bisher nur mit dem lokalen
 * Passwort-Login (z. B. in der lokalen Entwicklung).
 */

export const AUTHENTIK_PROVIDER_ID = "authentik";

/**
 * Pfad der vom Mitgliederbereich verwalteten Konten in Authentik. Unterordner
 * von "users" (Standardpfad), damit Theatermitglieder im Verzeichnisbaum
 * getrennt von den übrigen Konten stehen.
 */
export const AUTHENTIK_MANAGED_USER_PATH = "users/theater";

/**
 * Früherer Pfad (bis v1.2.x). Konten dort gelten weiter als verwaltet und
 * werden beim nächsten Abgleich nach AUTHENTIK_MANAGED_USER_PATH verschoben.
 * Kann entfallen, sobald kein Konto mehr unter diesem Pfad liegt.
 */
export const AUTHENTIK_LEGACY_USER_PATH = "mitgliederbereich";

/**
 * Kurzlebiges Cookie mit dem Onboarding-Token, damit deaktivierte Rückkehrer
 * auch beim Login über Authentik wieder aktiviert werden.
 */
export const ONBOARDING_TOKEN_COOKIE = "theater-onboarding-token";

const DEFAULT_RECOVERY_EMAIL_STAGE = "theater-recovery-email";
const DEFAULT_LOGOUT_FLOW = "theater-logout";

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
function getAuthentikBaseUrl(): string | null {
  let baseUrl = readEnv("AUTHENTIK_URL");
  const issuer = readEnv("AUTHENTIK_ISSUER");
  if (!baseUrl && issuer) {
    try {
      baseUrl = new URL(issuer).origin;
    } catch (error) {
      console.error("[authentik] AUTHENTIK_ISSUER ist keine gültige URL", error);
    }
  }
  return baseUrl ? baseUrl.replace(/\/+$/, "") : null;
}

export function getAuthentikApiConfig(): AuthentikApiConfig | null {
  const token = readEnv("AUTHENTIK_API_TOKEN");
  const baseUrl = getAuthentikBaseUrl();
  if (!token || !baseUrl) return null;
  return {
    baseUrl,
    token,
    recoveryEmailStage: readEnv("AUTHENTIK_RECOVERY_EMAIL_STAGE") ?? DEFAULT_RECOVERY_EMAIL_STAGE,
  };
}

/**
 * Abmelde-Flow in Authentik (Blueprint "theater-logout"). Beendet die
 * Authentik-Session und leitet über `?next=` zurück zur Website. Bewusst nicht
 * der OIDC-Endpunkt end-session: Der verlangt in Authentik 2025.4 eine aktive
 * Session und ignoriert post_logout_redirect_uri.
 */
export function getAuthentikLogoutUrl(): string | null {
  if (!isAuthentikLoginEnabled()) return null;
  const baseUrl = getAuthentikBaseUrl();
  if (!baseUrl) return null;
  const flow = readEnv("AUTHENTIK_LOGOUT_FLOW") ?? DEFAULT_LOGOUT_FLOW;
  return `${baseUrl}/if/flow/${encodeURIComponent(flow)}/`;
}

/** Anmeldung über Authentik ist möglich, sobald der OIDC-Client konfiguriert ist. */
export function isAuthentikLoginEnabled(): boolean {
  return getAuthentikOidcConfig() !== null;
}

/**
 * Der Mitgliederbereich darf Authentik-Konten anlegen und ändern (Passwörter,
 * Abgleich, Passwort-Mails). Dafür braucht er zusätzlich den API-Token.
 *
 * Staging bekommt bewusst keinen Token: Es teilt sich Authentik mit der
 * Produktion und arbeitet mit einer Kopie der echten Mitglieder. Dort ist nur
 * der Login über Authentik aktiv; Tests (E-Mail ändern, Löschen, Passwörter)
 * verändern so keine echten Konten.
 */
export function isAuthentikProvisioningEnabled(): boolean {
  return isAuthentikLoginEnabled() && getAuthentikApiConfig() !== null;
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
 * Ohne Authentik-Konten (keine Konfiguration oder Staging ohne API-Token)
 * bleibt der Passwort-Login dauerhaft aktiv, weil nichts migriert werden kann.
 * Sonst gilt er nur bis zum Stichtag (ohne Stichtag unbefristet).
 */
export function isLegacyPasswordLoginActive(now: Date = new Date()): boolean {
  if (!isAuthentikProvisioningEnabled()) return true;
  const deadline = getLegacyPasswordLoginDeadline();
  return !deadline || now < deadline;
}
