import { expect, test } from "@playwright/test";

import { authFile } from "./env";

// Keine Seite darf breiter als der Viewport werden, sonst zoomt das Gerät heraus.
// Breite Inhalte (Kalender, Tabellen, Heatmaps) müssen innerhalb ihrer Karte scrollen.
// Der Viewport kommt aus dem Playwright-Projekt (chromium/mobile/tablet-portrait/tablet-landscape).
const ROUTES = [
  "/mitglieder",
  "/mitglieder/meine-proben",
  "/mitglieder/probenplanung",
  "/mitglieder/produktionen",
  "/mitglieder/produktionen/stueck",
  "/mitglieder/produktionen/stueck?ansicht=rollen",
  "/mitglieder/produktionen/stueck?ansicht=auftritte",
  "/mitglieder/meine-gewerke",
  "/mitglieder/profil",
  "/mitglieder/sperrliste",
  "/mitglieder/fotoerlaubnisse",
  "/mitglieder/koerpermasse",
  "/mitglieder/onboarding",
  "/mitglieder/mitgliederverwaltung",
  "/mitglieder/mitgliederverwaltung/aufbewahrung",
  "/mitglieder/rechte",
  "/mitglieder/website",
  "/mitglieder/pages/seitensteuerung",
  "/mitglieder/server-analytics",
  "/mitglieder/server-einstellungen",
];

// Dokumentierte Tablet-Schuld: Die Sperrlisten-Timeline erzwingt `min-w-[900px]`
// (sperrliste/overview/TimelineView.tsx) und die Desktop-Tabelle hat eine Sticky-Spalte
// plus sieben Tagesspalten (~1050px). Fix in Phase 2, Status in docs/responsiveness-matrix.md.
const TABLET_OVERFLOW_KNOWN = new Set(["/mitglieder/sperrliste"]);

test.describe("kein horizontales Überlaufen", () => {
  test.use({ storageState: authFile("admin") });

  for (const route of ROUTES) {
    test(route, async ({ page }) => {
      const project = test.info().project.name;
      test.skip(
        TABLET_OVERFLOW_KNOWN.has(route) &&
          (project === "tablet-portrait" || project === "tablet-landscape"),
        "Bekannte Tablet-Schuld, siehe docs/responsiveness-matrix.md (Phase 2)",
      );
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page).not.toHaveURL(/\/login/);
      const { width } = page.viewportSize() ?? { width: 1280, height: 720 };
      // Nicht window.innerWidth: beim Herauszoomen wächst es mit. Wiederholt messen,
      // weil einblendende Elemente kurz nach dem Laden noch überstehen können.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth), { timeout: 5_000 })
        .toBeLessThanOrEqual(width + 1);
    });
  }
});
