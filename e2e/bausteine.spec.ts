import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";

// Termine mit Bausteinen (docs/terminplanung-plan.md, Phase 6): Planung legt einen
// Gewerk-Baustein an und merkt die Probe vor, die Gewerk-Leitung organisiert ihn im
// Gewerk-Dashboard. Läuft nur über die Oberfläche (auch auf Staging) und räumt am Ende auf.
// Lokale Demo-Daten ohne Klickerei: `pnpm demo:bausteine` (docs/e2e-tests.md).

const stamp = Date.now().toString(36);
const title = `E2E Bausteine ${stamp}`;

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Editor-Adresse der angelegten Probe, zum Aufräumen. */
let editorUrl: string | null = null;

async function deleteRehearsal(page: Page) {
  if (!editorUrl) return;
  await page.goto(editorUrl);
  editorUrl = null;
  await page.getByRole("button", { name: "Löschen" }).click();
  await page.getByRole("button", { name: "Löschen", exact: true }).last().click();
  await expect(page).toHaveURL(/\/mitglieder\/terminplanung$/);
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test.afterEach(async ({ page }) => {
    await deleteRehearsal(page);
  });

  test("Gewerk-Baustein anlegen, vormerken und im Gewerk organisieren", async ({ page }) => {
    const errors = await collectErrors(page);

    await page.goto("/mitglieder/terminplanung");
    const create = page.getByRole("button", { name: "Neu", exact: true });
    test.skip(!(await create.isVisible().catch(() => false)), "Keine Terminplanung verfügbar");
    await create.click();
    await page.getByRole("menuitem", { name: "Probe" }).click();
    await expect(page).toHaveURL(/\/mitglieder\/terminplanung\/[^/]+$/);
    editorUrl = new URL(page.url()).pathname;

    await page.getByLabel("Titel", { exact: true }).fill(title);

    // Gewerk-Baustein: erstes Gewerk der Produktion
    const departmentSelect = page.getByRole("combobox", { name: "Gewerk-Baustein" });
    test.skip(!(await departmentSelect.count()), "Produktion ohne Gewerke");
    await departmentSelect.click();
    const option = page.getByRole("option").first();
    const department = (await option.innerText()).trim();
    await option.click();
    await page.getByPlaceholder("z. B. Bühnenbau").fill("E2E Baustein");
    await expect(page.getByText("Baustein E2E Baustein").first()).toBeVisible();
    await expect(page.getByText(/^Gespeichert/)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Vormerken" }).click();
    await expect(page).toHaveURL(/\/mitglieder\/proben\/[^/]+$/);
    await expect(page.getByText(`E2E Baustein (Gewerk ${department})`)).toBeVisible();

    // Gewerk-Leitung (admin darf als Regie jedes Gewerk verwalten)
    await page.goto("/mitglieder/meine-gewerke");
    const teamLink = page.getByRole("link", { name: department }).first();
    test.skip(!(await teamLink.count()), `Gewerk ${department} nicht in „Meine Teams“`);
    await teamLink.click();
    await page.getByRole("link", { name: /^Termine/ }).click();
    const card = page.getByRole("button", { name: `${title} öffnen` });
    await expect(card).toBeVisible();
    await expect(page.getByText(/Euer Teil: E2E Baustein/)).toBeVisible();

    await card.click();
    await page.getByRole("button", { name: "Baustein organisieren" }).click();
    await page.getByPlaceholder("optional, z. B. Werkstatt").fill("E2E Raum");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Baustein gespeichert")).toBeVisible();
    await expect(page.getByText(/Euer Teil: E2E Baustein.*E2E Raum/)).toBeVisible();

    // Seite darf mobil wie am Desktop nicht seitlich überlaufen
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});
