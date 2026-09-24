import { existsSync } from "node:fs";
import path from "node:path";

// Lokale Zugangsdaten für Staging-Tests (pnpm e2e:env, nie committen – .env* ist ignoriert).
const envFile = path.resolve(import.meta.dirname, "..", ".env.e2e.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// localhost statt 127.0.0.1: next dev blockt fremde Origins, die Seite hydriert sonst nicht.
export const E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? process.env.SCAN_E2E_BASE_URL ?? "http://localhost:3000";

export const E2E_LOGIN_SECRET = process.env.E2E_LOGIN_SECRET ?? "";

// Rollen aus src/lib/auth-dev-test-users.ts, für die das Setup eine Session anlegt.
export const E2E_ROLES = (process.env.E2E_ROLES ?? "member,admin")
  .split(",")
  .map((role) => role.trim())
  .filter(Boolean);

export function authFile(role: string) {
  return path.resolve(import.meta.dirname, ".auth", `${role}.json`);
}
