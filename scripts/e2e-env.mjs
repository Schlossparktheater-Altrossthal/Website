#!/usr/bin/env node
// Holt den Staging-Test-Login aus dem Cluster in .env.e2e.local (docs/e2e-tests.md).
// Quelle: Vault apps/theater-website-staging/theater-website-staging-e2e -> Secret theater-website-e2e.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const NAMESPACE = "theater-website-staging";
const SECRET = "theater-website-e2e";
const BASE_URL = "https://staging.sommertheater-altrossthal.de";

let encoded;
try {
  encoded = execFileSync(
    "kubectl",
    ["get", "secret", SECRET, "-n", NAMESPACE, "-o", "jsonpath={.data.E2E_LOGIN_SECRET}"],
    { encoding: "utf8" },
  ).trim();
} catch (error) {
  console.error(`[e2e-env] kubectl get secret ${SECRET} fehlgeschlagen`, error);
  process.exit(1);
}
if (!encoded) {
  console.error(
    `[e2e-env] ${SECRET} hat keinen Key E2E_LOGIN_SECRET (Vault/ExternalSecret prüfen)`,
  );
  process.exit(1);
}

const file = path.resolve(import.meta.dirname, "..", ".env.e2e.local");
const secret = Buffer.from(encoded, "base64").toString("utf8");
writeFileSync(file, `E2E_BASE_URL=${BASE_URL}\nE2E_LOGIN_SECRET=${secret}\n`, { mode: 0o600 });
console.warn(`[e2e-env] ${path.basename(file)} geschrieben (${BASE_URL})`);
