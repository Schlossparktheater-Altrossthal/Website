// Gemeinsame Bausteine der Playwright-Skripte (Screenshots, UI-Check).
// Anmeldung über /api/dev/screenshot-session – Details in docs/e2e-tests.md.
import { existsSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

export const SCRIPT_ROOT = path.resolve(import.meta.dirname, "..", "..");

// Presets für `--viewport`: Handy, zwei Tablet-Lagen und Desktop.
export const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  "tablet-portrait": { width: 834, height: 1112, deviceScaleFactor: 2, hasTouch: true },
  "tablet-small": { width: 768, height: 1024, deviceScaleFactor: 2, hasTouch: true },
  "tablet-landscape": { width: 1024, height: 768, deviceScaleFactor: 2, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

// Legt .env.e2e.local in die Umgebung (Staging-Secret, ignoriert von git).
export function loadE2EEnv() {
  const envFile = path.join(SCRIPT_ROOT, ".env.e2e.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

export function resolveBaseURL(explicit) {
  return (
    explicit ?? process.env.E2E_BASE_URL ?? process.env.SCAN_E2E_BASE_URL ?? "http://localhost:3000"
  );
}

// `--viewport all|mobile,tablet-portrait|desktop`; ohne Angabe Desktop.
export function resolveViewports({ viewport, mobile } = {}) {
  if (viewport) {
    const wanted =
      viewport === "all"
        ? Object.keys(VIEWPORTS)
        : viewport
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
  if (mobile) {
    console.warn("--mobile ist veraltet – nutze --viewport mobile");
    return [{ name: "mobile", ...VIEWPORTS.mobile }];
  }
  return [{ name: "desktop", ...VIEWPORTS.desktop }];
}

export function launchBrowser({ headed = false, slowMo = 0 } = {}) {
  // `--lang=de-DE`: Datumsfelder richten sich nach der Browsersprache, nicht nach dem Locale im Kontext.
  return chromium.launch({ headless: !headed, slowMo, args: ["--lang=de-DE"] });
}

// Kontext mit Session für die Testrolle. Lokal (next dev) ohne Secret, auf Staging mit E2E_LOGIN_SECRET.
// `authenticate: false` für öffentliche Seiten (Login, Onboarding).
export async function createAuthedContext(
  browser,
  { baseURL, role = "admin", secret = "", viewport, colorScheme, authenticate = true },
) {
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

  if (authenticate) {
    const login = await context.request.get(
      `/api/dev/screenshot-session?role=${encodeURIComponent(role)}&mode=json`,
      { headers: secret ? { "x-e2e-login-secret": secret } : {}, maxRedirects: 0 },
    );
    if (!login.ok()) {
      throw new Error(`Test-Login fehlgeschlagen (${login.status()}): ${await login.text()}`);
    }
  }

  // Cookie-Banner (src/components/CookieBanner.tsx) vorab bestätigen.
  await context.addCookies([
    { name: "cookie_consent", value: "true", url: new URL(baseURL).origin },
  ]);

  return context;
}

// Client-Session (useSession) und Skeletons abwarten, sonst halbfertige Seiten.
export async function waitForPageReady(page, { timeout = 10_000, route = "" } = {}) {
  await page
    .waitForFunction(() => !document.querySelector(".animate-pulse, [aria-busy='true']"), null, {
      timeout,
    })
    .catch(() => console.warn(`[${route}] Ladezustand nach ${timeout / 1000} s noch sichtbar`));
}
