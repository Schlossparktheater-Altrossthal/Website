#!/usr/bin/env node
// Screenshots angemeldeter Seiten, hell und dunkel (docs/e2e-tests.md).
//   pnpm e2e:screenshots [--role admin] [--viewport mobile,tablet-portrait,desktop] [--out dir] [/mitglieder/proben ...]
// Viewports: mobile (390x844), tablet-portrait (834x1112), tablet-small (768x1024),
// tablet-landscape (1024x768), desktop (1440x900) oder "all". --mobile ist ein Alias für mobile.
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

// `pnpm e2e:screenshots -- --role x` reicht das `--` durch; parseArgs würde danach alles
// als Route lesen.
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();

const { values, positionals } = parseArgs({
  args,
  allowPositionals: true,
  options: {
    role: { type: "string", default: "admin" },
    out: { type: "string" },
    "base-url": { type: "string" },
    mobile: { type: "boolean", default: false },
    viewport: { type: "string" },
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

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  "tablet-portrait": { width: 834, height: 1112, deviceScaleFactor: 2, hasTouch: true },
  "tablet-small": { width: 768, height: 1024, deviceScaleFactor: 2, hasTouch: true },
  "tablet-landscape": { width: 1024, height: 768, deviceScaleFactor: 2, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

function resolveViewports(values) {
  if (values.viewport) {
    const wanted =
      values.viewport === "all"
        ? Object.keys(VIEWPORTS)
        : values.viewport
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean);
    const unknown = wanted.filter((entry) => !(entry in VIEWPORTS));
    if (unknown.length) {
      throw new Error(
        `Unbekannter Viewport: ${unknown.join(", ")} – erlaubt: ${Object.keys(VIEWPORTS).join(", ")} oder all`,
      );
    }
    return wanted.map((name) => ({ name, ...VIEWPORTS[name] }));
  }
  if (values.mobile) {
    console.warn("--mobile ist veraltet – nutze --viewport mobile");
    return [{ name: "mobile", ...VIEWPORTS.mobile }];
  }
  return [{ name: "desktop", ...VIEWPORTS.desktop }];
}

// Datumsfelder richten sich nach der Browsersprache, nicht nach dem Kontext-Locale.
const viewports = resolveViewports(values);
const browser = await chromium.launch({ args: ["--lang=de-DE"] });
let failed = false;
try {
  for (const { viewport, colorScheme } of viewports.flatMap((viewport) =>
    ["light", "dark"].map((colorScheme) => ({ viewport, colorScheme })),
  )) {
    const viewportDir = path.join(outDir, viewport.name);
    mkdirSync(viewportDir, { recursive: true });
    const context = await browser.newContext({
      baseURL,
      colorScheme,
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile ?? false,
      hasTouch: viewport.hasTouch ?? viewport.isMobile ?? false,
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
    page.on("pageerror", (error) =>
      console.error(`[${viewport.name}/${colorScheme}] pageerror:`, error.message),
    );
    for (const route of routes) {
      const name = `${viewport.name}-${values.role}-${colorScheme}${route.replace(/[^a-z0-9]+/gi, "_")}.png`;
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
        await page.screenshot({ path: path.join(viewportDir, name), fullPage: true });
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
