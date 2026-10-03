import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Lager-Tabellen-Workflow (docs/Plan/lager-tabelle-plan.md): Sammelerfassung per Tastatur und
// Einfügen, Bestand als Tabelle mit Mehrfachauswahl. Alle Daten tragen das Präfix „E2E“ und
// werden am Ende ausgemustert.

const stamp = Date.now().toString(36);

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function createLocation(page: Page, name: string) {
  await page.goto("/mitglieder/lager/orte");
  await clickUntil(page.getByRole("button", { name: "Lager / Raum anlegen" }), () =>
    expect(page.getByRole("dialog")).toBeVisible(),
  );
  await page.getByRole("dialog").getByLabel("Name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
  const link = page.getByRole("link", { name: new RegExp(name) });
  await expect(link).toBeVisible();
  const code = (await link.textContent())?.match(/L-\d{4,}/)?.[0];
  expect(code).toBeTruthy();
  return code!;
}

async function deleteLocation(page: Page, name: string) {
  await page.goto("/mitglieder/lager/orte");
  await clickUntil(page.getByRole("button", { name: `Aktionen für ${name}` }), () =>
    expect(page.getByRole("menuitem", { name: "Löschen" })).toBeVisible(),
  );
  await page.getByRole("menuitem", { name: "Löschen" }).click();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
}

/** Fügt TSV ein wie aus einer Tabellenkalkulation kopiert. */
async function pasteTsv(page: Page, text: string) {
  await page.getByRole("grid").evaluate((grid, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    grid.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
  }, text);
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin"), viewport: { width: 1440, height: 900 } });
  test.describe.configure({ mode: "serial" });

  test("Sammelerfassung: tippen, einfügen, füllen, duplizieren, anlegen", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await collectErrors(page);
    const locationName = `E2E Tabellenregal ${stamp}`;
    const locationCode = await createLocation(page, locationName);
    await page.goto("/mitglieder/lager/neu/tabelle");
    await page.evaluate(() => localStorage.removeItem("lager:sammelerfassung:v1"));
    await page.reload();

    await clickUntil(page.getByRole("radio", { name: /Technik/ }), () =>
      expect(page.getByRole("radio", { name: /Technik/ })).toHaveAttribute("aria-checked", "true"),
    );
    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();

    // Zeile 1 per Tastatur: Name, Tab über Kategorie, Art „menge“, Menge 12, Ort per Code.
    await grid.getByRole("gridcell").first().click();
    await page.keyboard.type(`E2E Kabel ${stamp}`);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.type("menge");
    await page.keyboard.press("Tab");
    await page.keyboard.type("12");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.type(locationCode);
    await page.keyboard.press("Enter");
    await expect(grid.getByText(new RegExp(`${locationCode} · `))).toBeVisible();

    // Zeile 2 und 3 aus der Zwischenablage (Name, Kategorie leer, Art).
    await page.keyboard.press("Home");
    await pasteTsv(page, `E2E Scheinwerfer ${stamp}\t\tEinzelstück\nE2E Stativ ${stamp}\t\teinzel`);
    await expect(grid.getByText(`E2E Stativ ${stamp}`)).toBeVisible();

    // Zeile 3 duplizieren (×2) – jedes Stück bekommt später einen eigenen Code.
    await grid.getByText(`E2E Stativ ${stamp}`).click();
    await page.getByRole("button", { name: "Duplizieren" }).click();
    await page.getByLabel("Anzahl Kopien").fill("2");
    await page.getByRole("button", { name: "×2 einfügen" }).click();
    await expect(grid.getByText(`E2E Stativ ${stamp}`)).toHaveCount(3);

    // Unvollständige Zeile wird gemeldet und nicht angelegt.
    await grid.getByRole("gridcell").first().click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("Kiste");
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: /5 anlegen/ }).click();
    await expect(page.getByText(/^5 Objekte angelegt$/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /1 unvollständig/ })).toBeVisible();
    const codes = await grid.getByRole("link", { name: /^T-\d{4,}$/ }).allTextContents();
    expect(codes).toHaveLength(5);
    expect(new Set(codes).size).toBe(5);

    // Entwürfe überstehen ein Neuladen.
    await page.reload();
    await expect(grid.getByRole("link", { name: codes[0]! })).toBeVisible();
    await page.getByRole("button", { name: "Angelegte ausblenden" }).click();
    await expect(grid.getByRole("link", { name: /^T-\d{4,}$/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Zeile löschen" }).click();
    await page.evaluate(() => localStorage.removeItem("lager:sammelerfassung:v1"));

    // Mengenartikel mit Bestand angelegt.
    await page.goto(`/mitglieder/lager/objekt/${codes[0]}`);
    await expect(page.getByRole("heading", { level: 1, name: `E2E Kabel ${stamp}` })).toBeVisible();
    await expect(page.getByText("12 Stk.").first()).toBeVisible();

    // Bestand als Tabelle: nach Name sortiert, nur die Objekte dieses Laufs.
    await page.goto(
      `/mitglieder/lager?darstellung=tabelle&sortierung=name&q=${encodeURIComponent(stamp)}`,
    );
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: /^T-\d{4,}$/ })).toHaveCount(5);

    // Name direkt in der Zelle ändern.
    await clickUntil(table.getByRole("button", { name: `E2E Kabel ${stamp}` }), () =>
      expect(page.getByLabel(`Name von ${codes[0]}`)).toBeVisible(),
    );
    await page.getByLabel(`Name von ${codes[0]}`).fill(`E2E Kabel lang ${stamp}`);
    await page.keyboard.press("Enter");
    await expect(table.getByRole("button", { name: `E2E Kabel lang ${stamp}` })).toBeVisible();

    // Alle wählen, Zustand setzen, gemeinsam ausmustern (Aufräumen).
    await page.getByRole("checkbox", { name: "Alle auf dieser Seite wählen" }).click();
    await expect(page.getByText("5 Objekte ausgewählt")).toBeVisible();
    await page.getByRole("combobox", { name: "Zustand setzen" }).click();
    await page.getByRole("option", { name: "Gebraucht" }).click();
    await expect(page.getByText("5 geändert.")).toBeVisible();
    await expect(table.getByText("Gebraucht")).toHaveCount(5);
    await page.getByRole("button", { name: "Ausmustern" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ausmustern" }).click();
    await expect(page.getByText("5 ausgemustert.")).toBeVisible();
    await deleteLocation(page, locationName);

    expect(errors).toEqual([]);
  });
});
