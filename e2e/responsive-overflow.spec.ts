import { expect, test, type Page } from "@playwright/test";

import { waitForStableWidth } from "../scripts/lib/e2e-session.mjs";

import { authFile } from "./env";

// Keine Seite darf breiter als der Viewport werden, sonst zoomt das Gerät heraus.
// Breite Inhalte (Kalender, Tabellen, Heatmaps) müssen innerhalb ihrer Karte scrollen.
// Der Viewport kommt aus dem Playwright-Projekt (chromium, mobile, mobile-webkit,
// tablet-portrait, tablet-landscape).
//
// Die Messung der Dokumentbreite allein reicht nicht: Chromium und WebKit weichen im Layout ab,
// und ohne die schuldige Box ist ein Fehlschlag nicht zu bearbeiten. Deshalb sammelt der Test
// zusätzlich alle Elemente, die über den Rand ragen, und legt sie in die Fehlermeldung
// (docs/Plan/handy-responsiveness-plan.md, Phase 1).
//
// Statische Routen des Mitgliederbereichs. Breite Tabellen, Kalender und Heatmaps dürfen
// innerhalb ihrer Karte scrollen – solche Vorfahren werden unten nicht als Verursacher gemeldet.
// Zwei Einträge sind Alt-Routen und leiten per `redirect()` weiter (`/mitglieder/probenplanung`
// → `/mitglieder/terminplanung?art=proben`); die Messung folgt dem Client-Redirect (siehe
// `waitForStableWidth` in `scripts/lib/e2e-session.mjs`).
const STATIC_ROUTES = [
  "/mitglieder",
  "/mitglieder/profil",
  "/mitglieder/benachrichtigungen",
  "/mitglieder/meine-proben",
  "/mitglieder/meine-gewerke",
  "/mitglieder/meine-gewerke/kostuem",
  "/mitglieder/meine-gewerke/kostuem?ansicht=aufgaben",
  "/mitglieder/meine-gewerke/kostuem?ansicht=termine",
  "/mitglieder/meine-gewerke/kostuem?ansicht=team",
  "/mitglieder/produktionen",
  "/mitglieder/produktionen/stueck",
  "/mitglieder/produktionen/stueck?ansicht=rollen",
  "/mitglieder/produktionen/stueck?ansicht=auftritte",
  "/mitglieder/produktionen/zuweisung",
  "/mitglieder/produktionen/rueckmeldungen-auswertung",
  "/mitglieder/probenplanung",
  "/mitglieder/probenplanung/terminfinder",
  "/mitglieder/terminplanung",
  "/mitglieder/terminplanung/terminfinder",
  "/mitglieder/sperrliste",
  "/mitglieder/fotoerlaubnisse",
  "/mitglieder/koerpermasse",
  "/mitglieder/onboarding",
  "/mitglieder/datenportal",
  "/mitglieder/mitgliederverwaltung",
  "/mitglieder/mitgliederverwaltung/aufbewahrung",
  "/mitglieder/rechte",
  "/mitglieder/website",
  "/mitglieder/pages/seitensteuerung",
  "/mitglieder/server-analytics",
  "/mitglieder/server-einstellungen",
];

// Routen mit ID: Der erste passende Link der jeweiligen Übersicht liefert die echte ID.
// Ohne Eintrag im Datenstand entfällt die Route – künstliche IDs hätten keinen Inhalt und
// damit nichts zu messen.
const DETAIL_ROUTES: { name: string; list: string; pattern: string; suffix?: string }[] = [
  {
    name: "Gewerk-Portal",
    list: "/mitglieder/meine-gewerke",
    pattern: "^/mitglieder/meine-gewerke/[^/?]+$",
  },
  {
    name: "Produktion",
    list: "/mitglieder/produktionen",
    pattern:
      "^/mitglieder/produktionen/(?!stueck$|zuweisung$|besetzung$|szenen$|rueckmeldungen-auswertung$)[^/?]+$",
  },
  {
    name: "Produktion · Ensemble",
    list: "/mitglieder/produktionen",
    pattern:
      "^/mitglieder/produktionen/(?!stueck$|zuweisung$|besetzung$|szenen$|rueckmeldungen-auswertung$)[^/?]+$",
    suffix: "/ensemble",
  },
  {
    name: "Mitglied",
    list: "/mitglieder/mitgliederverwaltung",
    pattern: "^/mitglieder/mitgliederverwaltung/(?!aufbewahrung$)[^/?]+$",
  },
  {
    name: "Termin",
    list: "/mitglieder/meine-proben",
    pattern: "^/mitglieder/termine/[^/?]+$",
  },
  {
    name: "Termin · Probenmodus",
    list: "/mitglieder/meine-proben",
    pattern: "^/mitglieder/termine/[^/?]+$",
    suffix: "/probe",
  },
  {
    name: "Probe",
    list: "/mitglieder/probenplanung",
    pattern: "^/mitglieder/probenplanung/proben/[^/?]+$",
  },
  {
    name: "Terminplanung · Entwurf",
    list: "/mitglieder/terminplanung",
    pattern: "^/mitglieder/terminplanung/[^/?]+$",
  },
  {
    name: "Onboarding · Talente",
    list: "/mitglieder/onboarding",
    pattern: "^/mitglieder/onboarding/[^/?]+/talente/[^/?]+$",
  },
];

/**
 * Elemente, die über den Viewport hinausragen, als lesbare Zeilen. Vorfahren mit
 * `overflow-x: auto|scroll|hidden` sind erlaubt (Karten mit innerem Scrollbereich) und werden
 * übersprungen – dieselbe Regel wie in `scripts/ui-check.mjs`.
 *
 * Gemeldet werden beide Enden: die äußerste Box sagt, welcher Bereich zu breit ist, die innerste,
 * welcher Inhalt ihn aufreißt. Nur die äußerste zu nennen hilft bei der Behebung nicht weiter.
 */
async function overflowingElements(page: Page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const inScrollContainer = (element: Element) => {
      for (
        let parent = element.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") return true;
      }
      return false;
    };

    const candidates: Element[] = [];
    for (const element of document.querySelectorAll("body *")) {
      const box = element.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      if (box.right <= width + 1 && box.left >= -1) continue;
      if (inScrollContainer(element)) continue;
      candidates.push(element);
    }

    const describe = (element: Element) => {
      const box = element.getBoundingClientRect();
      const classes = String(element.className || "")
        .split(/\s+/)
        .slice(0, 3)
        .join(".");
      const text = (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return (
        `<${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}>` +
        ` rechts ${Math.round(box.right)} px, Breite ${Math.round(box.width)} px` +
        `${text ? ` – „${text}“` : ""}`
      );
    };

    // Obergrenze, damit die paarweisen Vergleiche auf einer stark zerbrochenen Seite nicht
    // unbegrenzt laufen.
    const sample = candidates.slice(0, 200);
    const roots = sample.filter(
      (element) => !sample.some((other) => other !== element && other.contains(element)),
    );
    const leaves = sample.filter(
      (element) => !sample.some((other) => other !== element && element.contains(other)),
    );

    return [
      ...roots.slice(0, 3).map((element) => `äußerste Box: ${describe(element)}`),
      ...leaves.slice(0, 8).map((element) => `Inhalt:       ${describe(element)}`),
    ];
  });
}

async function expectNoHorizontalOverflow(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);

  const width = page.viewportSize()?.width ?? 1280;
  // Erst messen, wenn der Ladezustand weg ist und die Breite steht (`waitForStableWidth`):
  // gegen einen kalten Dev-Server liefert der halbfertige Aufbau falsche Befunde.
  const documentWidth = await waitForStableWidth(page, { route });
  if (documentWidth <= width + 1) return;

  const offenders = await overflowingElements(page);
  throw new Error(
    `Horizontaler Überlauf in ${route} bei ${width} px (Dokument ${documentWidth} px); ` +
      "es ragen heraus:\n" +
      (offenders.join("\n") ||
        "(kein Element gefunden – die Seite ist breiter als der Viewport, ohne sichtbaren Verursacher)"),
  );
}

/** Erster interner Link einer Übersicht, der auf `pattern` passt. */
async function firstMatchingHref(page: Page, listPath: string, pattern: string) {
  await page.goto(listPath, { waitUntil: "domcontentloaded" });
  return page.evaluate((source) => {
    const matcher = new RegExp(source);
    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");
      if (href && matcher.test(href)) return href;
    }
    return null;
  }, pattern);
}

test.describe("kein horizontales Überlaufen", () => {
  test.use({ storageState: authFile("admin") });

  for (const route of STATIC_ROUTES) {
    test(route, async ({ page }) => {
      await expectNoHorizontalOverflow(page, route);
    });
  }

  for (const detail of DETAIL_ROUTES) {
    test(`${detail.name} (${detail.list})`, async ({ page }) => {
      const href = await firstMatchingHref(page, detail.list, detail.pattern);
      if (!href) {
        test.skip(true, `Kein Link auf ${detail.list} – der Datenstand hat keinen Eintrag`);
        return;
      }
      await expectNoHorizontalOverflow(page, `${href}${detail.suffix ?? ""}`);
    });
  }
});
