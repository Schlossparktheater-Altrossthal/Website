import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Lager-Projekte (docs/Plan/lager-typen-projekte-plan.md, Phase 6): zwei Projekte im selben
// Zeitraum teilen sich einen Artikeltyp mit zwei Exemplaren – das zweite meldet „fehlt“.
// Alle Daten tragen das Präfix „E2E“ und werden am Ende entfernt.

const stamp = Date.now().toString(36);

async function createProject(page: Page, title: string, status: "Bestätigt" | "Angefragt") {
  await page.goto("/mitglieder/lager/projekte/neu");
  await page.getByLabel("Event / Titel").fill(title);
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: status }).click();
  await page.getByLabel("Kunde").fill(`E2E Kunde ${stamp}`);
  await page.getByLabel("Veranstaltungsort").fill("Berlin");
  // Aufbau, Veranstaltung, Abbau – weit in der Zukunft, damit nichts anderes stört.
  await page.locator("#phase-0-from").fill("2031-06-12");
  await page.locator("#phase-1-from").fill("2031-06-13");
  await page.locator("#phase-2-from").fill("2031-06-14");
  await page.getByRole("button", { name: "Projekt anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/12\.06\. – .*14\.06\.2031/)).toBeVisible();
}

async function addMaterial(page: Page, name: string, quantity: number) {
  await clickUntil(page.getByRole("button", { name: "Material", exact: true }), () =>
    expect(page.getByLabel("Artikel suchen")).toBeVisible(),
  );
  await page.getByLabel("Artikel suchen").fill(name);
  await page.getByLabel("Menge", { exact: true }).fill(String(quantity));
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByLabel(`Menge ${name}`)).toHaveValue(String(quantity));
  await page.getByRole("button", { name: "Fertig" }).click();
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Projekte: anlegen, Material einplanen, Konflikt erkennen, löschen", async ({ page }) => {
    test.setTimeout(180_000);
    const product = `E2E Projektlampe ${stamp}`;

    // Artikeltyp mit zwei Exemplaren.
    await page.goto("/mitglieder/lager/neu");
    await page.getByLabel("Was möchtest du erfassen?").fill(product);
    await clickUntil(page.getByRole("button", { name: `Neuer Artikeltyp „${product}“` }), () =>
      expect(page.getByText("Neuer Artikeltyp", { exact: true })).toBeVisible(),
    );
    await page.getByLabel("Anzahl").fill("2");
    await page.getByRole("button", { name: "2 anlegen" }).click();
    await expect(page.getByText("2 Exemplare angelegt")).toBeVisible({ timeout: 20_000 });
    const range = (await page.locator("p.text-sm .font-mono").first().textContent()) ?? "";
    const [first] = range.match(/T-\d+(?:-\d+)?/g) ?? [];
    expect(first).toBeTruthy();

    // Set aus zwei Lampen: aus dem Bestand lässt sich genau eines zusammenstellen.
    const setName = `E2E Lampenpaar ${stamp}`;
    await page.goto("/mitglieder/lager/neu");
    await page.getByLabel("Was möchtest du erfassen?").fill(setName);
    await clickUntil(page.getByRole("button", { name: `Neuer Artikeltyp „${setName}“` }), () =>
      expect(page.getByText("Neuer Artikeltyp", { exact: true })).toBeVisible(),
    );
    await page.getByRole("radio", { name: "Set" }).click();
    await page.getByLabel("Bestandteil suchen").fill(product);
    await page.getByRole("button", { name: new RegExp(product) }).click();
    await page.getByLabel(`Anzahl ${product} je Set`).fill("2");
    await page.getByRole("button", { name: "Set anlegen" }).click();
    await expect(page.getByRole("heading", { level: 1, name: setName })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("1 Set", { exact: true })).toBeVisible();

    const projectA = `E2E Stadtfest ${stamp}`;
    await createProject(page, projectA, "Bestätigt");
    await addMaterial(page, product, 2);
    await expect(page.getByText("frei", { exact: true })).toBeVisible();
    const urlA = page.url();

    const projectB = `E2E Firmenfeier ${stamp}`;
    await createProject(page, projectB, "Angefragt");
    await addMaterial(page, product, 1);
    await expect(page.getByText("fehlt", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: projectA })).toBeVisible();
    const urlB = page.url();

    // Aufräumen: Projekte löschen, Exemplare ausmustern.
    for (const url of [urlB, urlA]) {
      await page.goto(`${url}/bearbeiten`);
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Löschen" }).click();
      await expect(page).toHaveURL(/\/lager\/projekte$/);
    }
    // „T-12-1“ → zweites Exemplar „T-12-2“.
    const [, type, unit] = first!.match(/^T-(\d+)-(\d+)$/)!;
    for (const code of [first!, `T-${type}-${Number(unit) + 1}`]) {
      await page.goto(`/mitglieder/lager/objekt/${code}`);
      await clickUntil(page.getByRole("button", { name: "Weitere Aktionen" }), () =>
        expect(page.getByRole("menuitem", { name: "Ausmustern" })).toBeVisible(),
      );
      await page.getByRole("menuitem", { name: "Ausmustern" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Ausmustern" }).click();
      await expect(page.getByText("Ausgemustert – nur noch Ansicht")).toBeVisible();
    }
  });
});
