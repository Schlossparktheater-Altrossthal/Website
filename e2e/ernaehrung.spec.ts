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
    // Der Wert erscheint erst nach der Hydration.
    await expect(styleTrigger).toHaveText(/\S/);

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

  async function openAdd(page: Page) {
    await clickUntil(page.getByRole("button", { name: "Hinzufügen", exact: true }), async () => {
      await expect(page.locator("#restriction-text")).toBeVisible({ timeout: 1_500 });
    });
  }

  async function removeChip(page: Page, label: string) {
    await page.getByRole("button", { name: new RegExp(label) }).click();
    await page.getByRole("button", { name: "Entfernen", exact: true }).first().click();
    await page.getByRole("button", { name: "Entfernen", exact: true }).last().click();
    await expectSaved(page, "Entfernt");
    await expect(page.getByRole("button", { name: new RegExp(label) })).toHaveCount(0);
  }

  test("legt eine Abneigung an und entfernt sie wieder", async ({ page }) => {
    const label = `E2E-Testabneigung ${Date.now()}`;
    await page.goto(AREA);
    await openAdd(page);
    await page.locator("#restriction-text").fill(label);
    await page.getByRole("radio", { name: "Mag ich nicht" }).click();
    await page.locator("#restriction-note").fill("von der Prüfung angelegt");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();

    await expectSaved(page, "Gespeichert");
    await expect(
      page.getByRole("button", { name: new RegExp(`${label}.*Mag nicht`) }),
    ).toBeVisible();
    await removeChip(page, label);
  });

  test("legt eine schwere Allergie an und entfernt sie wieder", async ({ page }) => {
    const allergen = `E2E-Testallergen ${Date.now()}`;
    await page.goto(AREA);
    await openAdd(page);

    // Schnellauswahl belegt Text und Stufe vor: Laktose ist eine Unverträglichkeit.
    await page.getByRole("button", { name: "Laktose", exact: true }).click();
    await expect(page.locator("#restriction-text")).toHaveValue("Laktose");
    await expect(page.getByRole("radio", { name: "Verträgt nicht" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.locator("#restriction-text").fill(allergen);
    await page.getByRole("radio", { name: "Schwer" }).click();
    await page.getByRole("radio", { name: "Gefährlich" }).click();
    await page.getByRole("switch", { name: "Ärztlich abgeklärt" }).click();
    await page.getByRole("button", { name: "Speichern", exact: true }).click();

    await expectSaved(page, "Gespeichert");
    await expect(
      page.getByRole("button", { name: new RegExp(`${allergen}.*Schwer`) }),
    ).toBeVisible();
    await removeChip(page, allergen);
  });
});
