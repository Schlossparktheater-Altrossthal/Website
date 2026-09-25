import { expect, test } from "@playwright/test";

import { authFile } from "./env";

// Mobil darf keine Seite breiter als der Bildschirm werden, sonst zoomt das Handy heraus.
// Breite Inhalte (Kalender, Tabellen, Heatmaps) müssen innerhalb ihrer Karte scrollen.
const ROUTES = [
  "/mitglieder",
  "/mitglieder/meine-proben",
  "/mitglieder/probenplanung",
  "/mitglieder/produktionen",
  "/mitglieder/produktionen/besetzung",
  "/mitglieder/produktionen/gewerke",
  "/mitglieder/profil",
  "/mitglieder/sperrliste",
  "/mitglieder/fotoerlaubnisse",
  "/mitglieder/koerpermasse",
  "/mitglieder/onboarding",
  "/mitglieder/mitgliederverwaltung",
];

test.describe("mobil ohne horizontales Überlaufen", () => {
  test.use({
    storageState: authFile("admin"),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  for (const route of ROUTES) {
    test(route, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      // Nicht window.innerWidth: beim Herauszoomen wächst es mit. Wiederholt messen,
      // weil einblendende Elemente kurz nach dem Laden noch überstehen können.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth), { timeout: 5_000 })
        .toBeLessThanOrEqual(390 + 1);
    });
  }
});
