// Gemeinsame Bausteine der Playwright-Skripte (Screenshots, UI-Check).
// Anmeldung über /api/dev/screenshot-session – Details in docs/e2e-tests.md.
import { existsSync } from "node:fs";
import path from "node:path";

import { chromium, webkit } from "@playwright/test";

export const SCRIPT_ROOT = path.resolve(import.meta.dirname, "..", "..");

// Presets für `--viewport`: Handy, drei Tablet-Breiten und Desktop.
// `mobile-iphone` ist die Referenz des gemeldeten Geräts (iPhone 17, 402 px); `mobile` bleibt die
// schmalere Referenz. `tablet-mini` ist das iPad mini hochkant (744 px) – es liegt unter dem
// `md`-Breakpoint (768 px) und damit in einer Lücke zwischen `tablet-portrait` (834 px) und Handy.
export const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  "mobile-iphone": { width: 402, height: 874, deviceScaleFactor: 3, isMobile: true },
  "tablet-mini": { width: 744, height: 1133, deviceScaleFactor: 2, hasTouch: true },
  "tablet-portrait": { width: 834, height: 1112, deviceScaleFactor: 2, hasTouch: true },
  "tablet-small": { width: 768, height: 1024, deviceScaleFactor: 2, hasTouch: true },
  "tablet-landscape": { width: 1024, height: 768, deviceScaleFactor: 2, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

// Legt die E2E-Env in die Umgebung: `.env.e2e.local` (Staging-Secret, gitignored) hat Vorrang,
// `.env` dient als Rückfall für lokale Läufe mit eigenem Secret. loadEnvFile überschreibt
// nichts, deshalb entscheidet die Reihenfolge.
export function loadE2EEnv() {
  for (const name of [".env.e2e.local", ".env"]) {
    const envFile = path.join(SCRIPT_ROOT, name);
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }
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

export function launchBrowser({ headed = false, slowMo = 0, browser = "chromium" } = {}) {
  // WebKit ist die Engine von iOS – Überlaufverhalten und Layout weichen dort von Chromium ab.
  // Der `mobile`-Prüflauf in Chromium hat den Überlauf auf dem iPhone nicht gefunden.
  const engines = { chromium, webkit };
  const engine = engines[browser];
  if (!engine) {
    throw new Error(
      `Unbekannte Browser-Engine "${browser}" – erlaubt: ${Object.keys(engines).join(", ")}`,
    );
  }

  if (browser !== "chromium") {
    return engine.launch({ headless: !headed, slowMo });
  }

  // `--lang=de-DE`: Datumsfelder richten sich nach der Browsersprache, nicht nach dem Locale im Kontext.
  // Die Throttle-Flags sind ein Sicherheitsnetz: Playwright prüft Klickziele über laufende
  // Animation-Frames und bricht sonst mit "element is not stable" ab. Ein echtes Browserfenster
  // hält den Takt auch verdeckt (gemessen ~60 fps), Chromium drosselt Hintergrundfenster aber
  // je nach Plattform – die Flags verhindern das (docs/e2e-tests.md).
  return chromium.launch({
    headless: !headed,
    slowMo,
    args: [
      "--lang=de-DE",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ],
  });
}

// Hilfestellung, wenn der Test-Login antwortet, aber keine Session liefert.
function loginHint(baseURL) {
  const isLocal =
    baseURL.includes("localhost") || baseURL.includes("127.0.0.1") || baseURL.includes("[::1]");
  return isLocal
    ? " – lokal gibt es den Test-Login nur außerhalb eines Production-Builds (pnpm dev statt pnpm start)"
    : " – für Staging einmal `pnpm e2e:env` ausführen (braucht kubectl-Zugang zum Cluster)";
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
      throw new Error(
        `Test-Login fehlgeschlagen (${login.status()}): ${await login.text()}${loginHint(baseURL)}`,
      );
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

/** `page.evaluate` scheitert, wenn mitten in der Messung eine Navigation den Kontext abreißt. */
function isDestroyedContextError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Execution context was destroyed") ||
    message.includes("Cannot find context with specified id")
  );
}

/**
 * Breite des Dokuments, `null` solange der Dokumentwechsel läuft.
 *
 * Beim Wechsel ist `document.documentElement` kurz `null` – gemessen als
 * `Cannot read properties of null (reading 'scrollWidth')`. Das ist kein Fehler, sondern ein
 * Zwischenstand: lieber keinen Wert melden als einen falschen (`0` würde als „kein Überlauf“
 * durchgehen).
 */
function readDocumentWidth(page) {
  return page.evaluate(() => document.documentElement?.scrollWidth ?? null);
}

/**
 * Dokumentbreite erst messen, wenn sie sich eingependelt hat.
 *
 * `next dev` liefert das HTML aus, bevor React hydratisiert hat, und Skeletons haben andere
 * Breiten als der fertige Inhalt. Auf einem kalten Dev-Server kommen die ersten Aufrufe eines
 * Laufs hinzu. Ohne diese Wartezeit misst ein Überlauf-Test gegen einen halbfertigen Aufbau:
 * Am 2026-09-29 meldete `e2e/responsive-overflow.spec.ts` fünf Seiten als überlaufend, die im
 * warmen Lauf alle grün waren – bei unverändertem Code und Datenstand.
 *
 * Deshalb: erst den Ladezustand abwarten, dann die Breite zweimal hintereinander gleich messen.
 * Zusätzlich muss die Adresse gleich bleiben – eine neue Adresse heißt neue Seite, und deren
 * halbfertige Breite ist keine Aussage.
 *
 * **Client-Redirects sind erlaubt.** Next liefert `redirect()` einer Seite als Anweisung im
 * RSC-Payload aus (HTTP 200), wenn ein Elter-Layout davor schon gestreamt hat; die Umleitung
 * läuft dann erst nach der Hydration im Browser. Genau das passiert auf den eingedampften
 * Alt-Routen `/mitglieder/probenplanung` und `/mitglieder/probenplanung/terminfinder`. Reißt
 * dieser Wechsel die laufende Messung ab, wird sie auf der Zielseite neu begonnen, statt den
 * Lauf mit „Execution context was destroyed“ zu beenden (CI, 2026-09-30).
 *
 * `readyTimeout` ist bewusst kurz: Einzelne Seiten tragen ein dauerhaftes `animate-pulse`
 * (Statusanzeigen, die kein Skeleton sind). Ein langer Ladezustands-Timeout würde auf jeder
 * solchen Seite voll auslaufen; die eigentliche Zusicherung ist die stabile Breite darunter.
 */
export async function waitForStableWidth(
  page,
  { timeout = 15_000, readyTimeout = 3_000, pollMs = 250, route = "" } = {},
) {
  await waitForPageReady(page, { timeout: readyTimeout, route });

  const deadline = Date.now() + timeout;
  let previousWidth = null;
  let previousUrl = null;
  let stableSamples = 0;

  while (Date.now() < deadline) {
    const url = page.url();
    let width = null;
    try {
      width = await readDocumentWidth(page);
    } catch (error) {
      // Client-Redirect unterwegs: neuer Dokumentkontext, Messung beginnt von vorn. Bewusst ohne
      // erneuten Ladezustands-Check – der kostet auf Seiten mit Dauer-Puls seine volle Laufzeit
      // und wäre hier nur Wiederholung; stabile Breite und gleiche Adresse sind die Zusicherung.
      if (!isDestroyedContextError(error)) throw error;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }

    if (width === null || width !== previousWidth || url !== previousUrl) {
      stableSamples = 0;
      previousWidth = width;
      previousUrl = url;
    } else {
      stableSamples += 1;
      if (stableSamples >= 2) return width;
    }
    await page.waitForTimeout(pollMs);
  }

  console.warn(`[overflow] Dokumentbreite blieb nach ${timeout / 1000} s nicht stabil`);
  return previousWidth ?? 0;
}
