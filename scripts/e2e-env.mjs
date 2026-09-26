#!/usr/bin/env node
// Holt den Staging-Test-Login aus dem Cluster in .env.e2e.local (docs/e2e-tests.md).
// Quelle: Vault apps/theater-website-staging/theater-website-staging-e2e -> Secret theater-website-e2e.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const NAMESPACE = "theater-website-staging";
const SECRET = "theater-website-e2e";
const BASE_URL = "https://staging.sommertheater-altrossthal.de";

// kubectl braucht einen Kontext. Fehlt ~/.kube/config, ist aber die Lens-Datei vorhanden,
// wird sie verwendet – der Cluster ist nur aus dem LAN erreichbar.
function resolveKubeconfig() {
  if (process.env.KUBECONFIG) return process.env.KUBECONFIG;
  const fallback = path.join(homedir(), ".kube", "theater-config-lens");
  if (!existsSync(path.join(homedir(), ".kube", "config")) && existsSync(fallback)) {
    console.warn(`[e2e-env] kein ~/.kube/config – nutze ${fallback}`);
    return fallback;
  }
  return undefined;
}

const kubeconfig = resolveKubeconfig();

let encoded;
try {
  encoded = execFileSync(
    "kubectl",
    ["get", "secret", SECRET, "-n", NAMESPACE, "-o", "jsonpath={.data.E2E_LOGIN_SECRET}"],
    {
      encoding: "utf8",
      env: kubeconfig ? { ...process.env, KUBECONFIG: kubeconfig } : process.env,
      // Nicht minutenlang auf einen unerreichbaren Cluster warten.
      timeout: 30_000,
    },
  ).trim();
} catch (error) {
  const detail =
    error && typeof error === "object" && error.stderr
      ? String(error.stderr).trim().split("\n")[0]
      : error instanceof Error
        ? error.message.split("\n")[0]
        : String(error);
  console.error(
    `[e2e-env] kubectl get secret ${SECRET} fehlgeschlagen (KUBECONFIG=${kubeconfig ?? "Standard"})`,
  );
  console.error(
    "  Kontext mit `kubectl config get-contexts` prüfen, Erreichbarkeit mit `kubectl get ns`.",
  );
  console.error(`  ${detail}`);
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
