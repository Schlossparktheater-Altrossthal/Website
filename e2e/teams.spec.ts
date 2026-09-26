import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";

// Gewerke-Portal und Stück (docs/seiten/gewerke.md, docs/seiten/produktionen.md).
// Die Tests legen eigene Daten mit Präfix „E2E“ an und räumen sie am Ende wieder ab.

const stamp = Date.now().toString(36);

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function requireProduction(page: Page) {
  const missing = await page
    .getByText(/Wähle (zuerst|oben) eine (aktive )?Produktion/)
    .isVisible()
    .catch(() => false);
  test.skip(missing, "Testnutzer hat keine aktive Produktion");
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "serial" });

  test("Gewerk anlegen, Aufgabe, Termin und Datei, dann archivieren", async ({ page }) => {
    const errors = await collectErrors(page);
    const name = `E2E Gewerk ${stamp}`;

    await page.goto("/mitglieder/meine-gewerke");
    await requireProduction(page);
    await page.getByRole("button", { name: "Gewerk anlegen" }).click();
    await page.getByPlaceholder("z. B. Pyrotechnik").fill(name);
    await page.getByRole("button", { name: "Anlegen", exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();

    // Aufgabe im Board
    await page.getByRole("link", { name: /^Aufgaben/ }).click();
    await page.getByRole("button", { name: "Aufgabe", exact: true }).first().click();
    await page.getByPlaceholder("Was ist zu tun?").fill("E2E Aufgabe");
    await page.getByRole("button", { name: "Anlegen", exact: true }).click();
    await expect(page.getByText("E2E Aufgabe").first()).toBeVisible();

    // Termin mit Zusage
    await page.getByRole("link", { name: /^Termine/ }).click();
    await page.getByRole("button", { name: "Termin", exact: true }).click();
    await page.getByPlaceholder("z. B. Anprobe, Bautag, Besprechung").fill("E2E Termin");
    await page.getByRole("button", { name: "Anlegen und Team benachrichtigen" }).click();
    await expect(page.getByRole("button", { name: "E2E Termin öffnen" })).toBeVisible();

    // Datei im Team-Tab
    await page.getByRole("link", { name: /^Team \d/ }).click();
    const file = path.join(os.tmpdir(), `e2e-${stamp}.txt`);
    // 2 MB: über dem 1-MB-Limit von Server Actions, prüft die Upload-Route samt Ingress.
    writeFileSync(file, "E2E Datei\n".repeat(200_000));
    await page.locator("input[type=file]").setInputFiles(file);
    await expect(page.getByText(`e2e-${stamp}.txt`)).toBeVisible();

    // Aufräumen: Gewerk archivieren
    await page.getByRole("button", { name: "Bearbeiten" }).click();
    await page.getByRole("button", { name: "Archivieren" }).click();
    await page.getByRole("button", { name: "Archivieren" }).last().click();
    await expect(page).toHaveURL(/\/mitglieder\/meine-gewerke$/);
    await expect(page.getByText(name)).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("Stück: Rolle und Szene anlegen, Auftritt setzen, wieder löschen", async ({ page }) => {
    const errors = await collectErrors(page);
    const role = `E2E Rolle ${stamp}`;
    const scene = `E2E Szene ${stamp}`;

    await page.goto("/mitglieder/produktionen/stueck?ansicht=rollen");
    await requireProduction(page);
    await page.getByRole("button", { name: "Rolle", exact: true }).click();
    await page.getByPlaceholder("z. B. Atréju").fill(role);
    await page.getByRole("button", { name: "Anlegen", exact: true }).click();
    await expect(page).toHaveURL(/rolle=/);
    await page.keyboard.press("Escape");

    await page.goto("/mitglieder/produktionen/stueck");
    await page.getByRole("button", { name: "Szene", exact: true }).click();
    await page.getByPlaceholder("z. B. Der Buchladen").fill(scene);
    await page.getByRole("button", { name: role }).click();
    await page.getByRole("button", { name: "Anlegen", exact: true }).click();
    await expect(page).toHaveURL(/szene=/);
    await page.keyboard.press("Escape");
    await expect(page.getByText(scene)).toBeVisible();

    // Auftrittsplan zeigt die Rolle in der Szene
    await page.goto("/mitglieder/produktionen/stueck?ansicht=auftritte");
    await expect(
      page.getByRole("button", { name: new RegExp(`^${role} in Szene .*: dabei$`) }),
    ).toBeVisible();

    // Aufräumen
    await page.goto("/mitglieder/produktionen/stueck");
    await page.getByText(scene).click();
    await page.getByRole("button", { name: "Szene löschen" }).click();
    await page.getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(page.getByText(scene)).toHaveCount(0);

    await page.goto("/mitglieder/produktionen/stueck?ansicht=rollen");
    await page.getByText(role).click();
    await page.getByRole("button", { name: "Rolle löschen" }).click();
    await page.getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(page.getByText(role)).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});

test.describe("als member", () => {
  test.use({ storageState: authFile("member") });

  test("Meine Teams ohne Verwaltungsfunktionen", async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto("/mitglieder/meine-gewerke");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Gewerk anlegen" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("Stück ist Regie und Board vorbehalten", async ({ page }) => {
    await page.goto("/mitglieder/produktionen/stueck");
    await expect(page.getByRole("button", { name: "Szene", exact: true })).toHaveCount(0);
  });
});
