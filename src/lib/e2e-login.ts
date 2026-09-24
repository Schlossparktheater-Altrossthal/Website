import { timingSafeEqual } from "node:crypto";

/**
 * Test-Login für Playwright/Screenshots auf Staging (docs/e2e-tests.md).
 *
 * Aktiv nur, wenn `E2E_LOGIN_SECRET` gesetzt ist – das passiert ausschließlich
 * im Staging-Deployment (Vault-RandomSecret). Die Produktion setzt die Variable
 * nie, dort bleibt `/api/dev/screenshot-session` ein 404.
 */
export const E2E_LOGIN_HEADER = "x-e2e-login-secret";

const MIN_SECRET_LENGTH = 32;

function configuredSecret(): string | null {
  const value = process.env.E2E_LOGIN_SECRET?.trim();
  if (!value) return null;
  if (value.length < MIN_SECRET_LENGTH) {
    console.warn("[e2e-login] E2E_LOGIN_SECRET ist zu kurz und wird ignoriert");
    return null;
  }
  return value;
}

export function isE2eLoginEnabled(): boolean {
  return configuredSecret() !== null;
}

export function isValidE2eLoginSecret(provided: string | null): boolean {
  const expected = configuredSecret();
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
