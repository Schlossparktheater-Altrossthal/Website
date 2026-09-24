#!/usr/bin/env node
// Screenshots angemeldeter Seiten, hell und dunkel (docs/e2e-tests.md).
//   pnpm e2e:screenshots [--role admin] [--out dir] [/mitglieder/proben ...]
// Ziel: E2E_BASE_URL (Standard http://localhost:3000), auf Staging mit E2E_LOGIN_SECRET.
// Bilder landen außerhalb des Repos bzw. in ignorierten Ordnern (keine Binärdateien committen).
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env.e2e.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const DEFAULT_ROUTES = [
  "/mitglieder",
  "/mitglieder/meine-proben",
  "/mitglieder/proben",
  "/mitglieder/produktionen",
  "/mitglieder/profil",
  "/mitglieder/mitgliederverwaltung",
  "/mitglieder/sperrliste",
];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    role: { type: "string", default: "admin" },
    out: { type: "string" },
    "base-url": { type: "string" },
    mobile: { type: "boolean", default: false },
  },
});

const baseURL =
  values["base-url"] ??
  process.env.E2E_BASE_URL ??
  process.env.SCAN_E2E_BASE_URL ??
  "http://localhost:3000";
const secret = process.env.E2E_LOGIN_SECRET ?? "";
const routes = positionals.length ? positionals : DEFAULT_ROUTES;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.resolve(values.out ?? path.join(root, "test-results", "screenshots", stamp));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
let failed = false;
try {
  for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({
      baseURL,
      colorScheme,
      viewport: values.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: values.mobile ? 3 : 1,
    });
    const login = await context.request.get(
      `/api/dev/screenshot-session?role=${encodeURIComponent(values.role)}&mode=json`,
      { headers: secret ? { "x-e2e-login-secret": secret } : {}, maxRedirects: 0 },
    );
    if (!login.ok()) {
      throw new Error(`Test-Login fehlgeschlagen (${login.status()}): ${await login.text()}`);
    }

    // Cookie-Banner (src/components/CookieBanner.tsx) vorab bestätigen.
    await context.addCookies([
      { name: "cookie_consent", value: "true", url: new URL(baseURL).origin },
    ]);

    const page = await context.newPage();
    page.on("pageerror", (error) => console.error(`[${colorScheme}] pageerror:`, error.message));
    for (const route of routes) {
      const name = `${values.role}-${colorScheme}${route.replace(/[^a-z0-9]+/gi, "_")}.png`;
      try {
        await page.goto(route, { waitUntil: "networkidle" });
        // Client-Session (useSession) und Skeletons nachladen lassen, sonst halbfertige Seiten.
        await page
          .waitForFunction(
            () => !document.querySelector(".animate-pulse, [aria-busy='true']"),
            null,
            {
              timeout: 10_000,
            },
          )
          .catch(() => console.warn(`[${route}] Ladezustand nach 10 s noch sichtbar`));
        if (page.url().includes("/login")) console.warn(`[${route}] Weiterleitung zum Login`);
        await page.screenshot({ path: path.join(outDir, name), fullPage: true });
        console.warn(`✓ ${name}`);
      } catch (error) {
        failed = true;
        console.error(`✗ ${route}:`, error instanceof Error ? error.message : error);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.warn(`Screenshots in ${outDir}`);
process.exit(failed ? 1 : 0);
