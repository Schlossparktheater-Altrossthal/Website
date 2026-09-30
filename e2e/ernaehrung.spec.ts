import { expect, type Locator, type Page, test } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Nutrition area of the own profile: dietary style with the vegetarian sub-form, aversions and
// allergies incl. the allergen suggestions. See `docs/Plan/ernaehrung-allergien-plan.md`.
test.use({ storageState: authFile("member") });

const AREA = "/mitglieder/profil?bereich=ernaehrung";

/**
 * Öffnet ein Radix-Select und wählt eine Option. Der erste Klick kann vor der Hydration landen,
 * deshalb wiederholt `clickUntil` ihn, bis die Liste offen ist.
 */
async function selectOption(page: Page, trigger: Locator, label: string) {
  const option = page.getByRole("option", { name: label, exact: true });
  await clickUntil(trigger, async () => {
    await expect(option).toBeVisible({ timeout: 1_500 });
  });
  await option.click();
}

async function expectSaved(page: Page, message: string) {
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
}

test.describe("Ernährung & Allergien", () => {
  test("stellt den Stil inklusive Unterform um und macht es rückgängig", async ({ page }) => {
    await page.goto(AREA);
    const styleTrigger = page.locator("#dietary-style");
    await expect(styleTrigger).toBeVisible();

    const original = (await styleTrigger.textContent())?.trim() ?? "";
    expect(original).not.toBe("");

    await selectOption(page, styleTrigger, "Vegetarisch");
    // Die Unterform gehört nur zu vegetarisch.
    const variant = page.locator("#dietary-variant");
    await expect(variant).toBeVisible();
    await selectOption(page, variant, "Nur Milch, kein Ei");

    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expectSaved(page, "Ernährungsprofil gespeichert");

    await page.reload();
    await expect(page.locator("#dietary-style")).toHaveText("Vegetarisch");
    await expect(page.locator("#dietary-variant")).toHaveText("Nur Milch, kein Ei");

    // Zurückstellen, damit der Lauf den Datenstand nicht verändert.
    await selectOption(page, page.locator("#dietary-style"), original);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expectSaved(page, "Ernährungsprofil gespeichert");
    await page.reload();
    await expect(page.locator("#dietary-style")).toHaveText(original);
  });

  test("legt eine Besonderheit an und entfernt sie wieder", async ({ page }) => {
    const label = `E2E-Testbesonderheit ${Date.now()}`;
    await page.goto(AREA);

    await clickUntil(page.getByRole("button", { name: "Besonderheit", exact: true }), async () => {
      await expect(page.locator("#aversion-label")).toBeVisible({ timeout: 1_500 });
    });
    await page.locator("#aversion-label").fill(label);
    await page.locator("#aversion-note").fill("von der Prüfung angelegt");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();

    await expectSaved(page, "Besonderheit gespeichert");
    await expect(page.getByText(label, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `${label} entfernen` }).click();
    await page.getByRole("button", { name: "Entfernen", exact: true }).click();

    await expectSaved(page, "Besonderheit entfernt");
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  });

  test("legt eine Allergie über den Vorschlag an und entfernt sie wieder", async ({ page }) => {
    const allergen = `E2E-Testallergen ${Date.now()}`;
    await page.goto(AREA);

    await clickUntil(page.getByRole("button", { name: "Allergie", exact: true }), async () => {
      await expect(page.locator("#allergen")).toBeVisible({ timeout: 1_500 });
    });

    // Vorschlag aus dem Katalog: „Lakt" schlägt die Laktose-Intoleranz vor und belegt die Art vor.
    await page.locator("#allergen").fill("Lakt");
    const suggestion = page.getByRole("option", { name: /Laktose/ }).first();
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    await expect(page.locator("#allergy-kind")).toHaveText("Unverträglichkeit");

    await page.locator("#allergen").fill(allergen);
    await selectOption(page, page.locator("#allergy-level"), "Schwer");
    await selectOption(page, page.locator("#allergy-traces"), "Spuren sind gefährlich");
    await page.getByRole("switch", { name: "Ärztlich abgeklärt" }).click();
    await page.getByRole("button", { name: "Speichern", exact: true }).click();

    await expectSaved(page, "Allergie gespeichert");
    // Die Zeile trägt Allergen, Art, Schweregrad und Spuren-Angabe; die Art stammt aus dem Vorschlag.
    const row = page.getByText(allergen).first();
    await expect(row).toBeVisible();
    await expect(row).toHaveText(/Unverträglichkeit\s+Schwer\s+Keine Spuren/);

    await page.getByRole("button", { name: `${allergen} entfernen` }).click();
    await page.getByRole("button", { name: "Entfernen", exact: true }).click();

    await expectSaved(page, "Allergie entfernt");
    await expect(page.getByText(allergen)).toHaveCount(0);
  });
});
