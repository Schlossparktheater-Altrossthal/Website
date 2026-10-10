import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Lager (docs/Plan/inventar-plan.md, lager-typen-projekte-plan.md): Lagerort, Artikeltyp mit
// mehreren Exemplaren und Kiste anlegen, scannen, Mangel und Prüfung,
// Etiketten-PDF, öffentliche Scan-Seite – und am Ende alles ausmustern bzw. löschen.
// Alle Daten tragen das Präfix „E2E“.

const stamp = Date.now().toString(36);

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function createAsset(
  page: Page,
  name: string,
  kind: "Gerät" | "Kiste",
  place: string,
  count = 1,
) {
  await page.goto("/mitglieder/lager/neu");
  // Schritt 1: neuen Artikeltyp anlegen (Bereich ist vorbelegt: Technik).
  await page.getByLabel("Was möchtest du erfassen?").fill(name);
  await clickUntil(page.getByRole("button", { name: `Neuer Artikeltyp „${name}“` }), () =>
    expect(page.getByText("Neuer Artikeltyp", { exact: true })).toBeVisible(),
  );
  if (kind === "Kiste") await page.getByRole("radio", { name: "Kiste / Case" }).click();
  // Schritt 2: Anzahl und Ort.
  if (count > 1) await page.getByLabel("Anzahl").fill(String(count));
  await page.getByRole("combobox", { name: "Lagerort" }).click();
  await page.getByRole("option", { name: new RegExp(place) }).click();
  await page.getByRole("button", { name: /anlegen$|^Anlegen$/ }).click();
  const range = page.locator("p.text-sm .font-mono").first();
  await expect(range).toBeVisible({ timeout: 20_000 });
  const ends = (await range.textContent())?.match(/T-\d+-\d+/g) ?? [];
  expect(ends).toHaveLength(count > 1 ? 2 : 1);
  // „T-12-1 … T-12-3“ – Typnummer fest, Exemplarnummern fortlaufend.
  const [, type, first] = ends[0]!.match(/^T-(\d+)-(\d+)$/)!;
  return Array.from({ length: count }, (_, index) => `T-${type}-${Number(first) + index}`);
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "serial" });

  test("Lager: erfassen, scannen, Mangel, Prüfung, Etiketten, öffentlich, aufräumen", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    const errors = await collectErrors(page);
    const locationName = `E2E Regal ${stamp}`;
    const boxName = `E2E Kiste ${stamp}`;
    const itemName = `E2E Scheinwerfer ${stamp}`;

    // Lagerort anlegen.
    await page.goto("/mitglieder/lager/orte");
    await clickUntil(page.getByRole("button", { name: "Lager / Raum anlegen" }), () =>
      expect(page.getByRole("dialog")).toBeVisible(),
    );
    await page.getByRole("dialog").getByLabel("Name").fill(locationName);
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
    const locationLink = page.getByRole("link", { name: new RegExp(locationName) });
    await expect(locationLink).toBeVisible();
    const locationCode = (await locationLink.textContent())?.match(/L-\d+/)?.[0];
    expect(locationCode).toBeTruthy();

    // Kiste und Gerät erfassen.
    const [boxCode] = await createAsset(page, boxName, "Kiste", locationName);
    const itemCodes = await createAsset(page, itemName, "Gerät", locationName, 3);
    const itemCode = itemCodes[0]!;

    // Typ-Seite: drei Exemplare desselben Typs am Ort.
    await page.goto(`/mitglieder/lager/objekt/${itemCode}`);
    await clickUntil(page.getByRole("link", { name: "Alle 3 Exemplare dieses Typs" }), () =>
      expect(page).toHaveURL(/\/lager\/typ\//),
    );
    await expect(page.getByRole("heading", { level: 1, name: itemName })).toBeVisible();
    await expect(page.getByText("3 Exemplare", { exact: true }).first()).toBeVisible();

    // Scanner, Modus Einlagern: erst Kiste als Ziel, dann das Gerät (Eingabe statt Kamera).
    await page.goto("/mitglieder/lager/scannen?modus=einlagern");
    const manualInput = page.getByLabel("Code eingeben");
    if (!(await manualInput.isVisible().catch(() => false))) {
      await clickUntil(page.getByRole("button", { name: "Code eintippen" }), () =>
        expect(manualInput).toBeVisible(),
      );
    }
    await manualInput.fill(boxCode!);
    await manualInput.press("Enter");
    await expect(page.getByText(`Ziel: Kiste ${boxCode}`)).toBeVisible();
    await manualInput.fill(itemCode.toLowerCase().replace("-", ""));
    await manualInput.press("Enter");
    await expect(page.getByText(new RegExp(`→ ${boxCode}`))).toBeVisible();

    // Detailseite: liegt in der Kiste; Mangel sperrt, Behoben gibt frei.
    await page.goto(`/mitglieder/lager/objekt/${itemCode}`);
    await expect(
      page.getByRole("link", { name: new RegExp(`${boxCode} ${boxName}`) }),
    ).toBeVisible();
    await clickUntil(page.getByRole("button", { name: "Mangel", exact: true }), () =>
      expect(page.getByRole("dialog")).toBeVisible(),
    );
    const defect = page.getByRole("dialog");
    await defect.getByRole("radio", { name: /Gesperrt/ }).click();
    await defect.getByLabel("Was ist los?").fill("E2E Kabel lose");
    await defect.getByRole("button", { name: "Melden und sperren" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Gesperrt" })).toBeVisible();
    await page.getByRole("button", { name: "Behoben", exact: true }).click();
    await page.getByRole("button", { name: "Erledigt" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Gesperrt" })).toHaveCount(0);

    // Prüfung eintragen.
    await clickUntil(page.getByRole("button", { name: "Prüfung", exact: true }), () =>
      expect(page.getByRole("dialog")).toBeVisible(),
    );
    await page.getByRole("dialog").getByRole("button", { name: "Bestanden eintragen" }).click();
    await expect(page.getByText(/Geprüft bis/).first()).toBeVisible();

    // Etiketten-PDF.
    const pdf = await page.request.post("/api/lager/labels", {
      data: {
        codes: [itemCode, boxCode!, locationCode],
        templateId: "70x36",
        skip: 2,
        outlines: true,
        markPrinted: false,
        content: { showName: true, showArea: true, showInspection: true, showOrganisation: true },
      },
    });
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");

    // Öffentliche Scan-Seite ohne Login: nur über die zufällige Kennung, keine internen Daten.
    await page.goto(`/mitglieder/lager/objekt/${itemCode}`);
    const publicHref = await page.getByRole("link", { name: "Scan-Seite" }).getAttribute("href");
    expect(publicHref).toMatch(/^\/i\/[1-9A-HJ-NP-Za-km-z]{12}$/);
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const publicPage = await anonymous.newPage();
    await publicPage.goto(publicHref!);
    await expect(publicPage.getByRole("heading", { name: itemName })).toBeVisible();
    await expect(publicPage.getByText(/Anschaffung|Interne Notiz/)).toHaveCount(0);
    const guessed = await publicPage.goto(`/i/${itemCode}`);
    expect(guessed?.status()).toBe(404);
    await anonymous.close();

    // Aufräumen: ausmustern, dann Lagerort löschen.
    for (const code of [...itemCodes, boxCode!]) {
      await page.goto(`/mitglieder/lager/objekt/${code}`);
      await clickUntil(page.getByRole("button", { name: "Weitere Aktionen" }), () =>
        expect(page.getByRole("menuitem", { name: "Ausmustern" })).toBeVisible(),
      );
      await page.getByRole("menuitem", { name: "Ausmustern" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Ausmustern" }).click();
      await expect(page.getByText("Ausgemustert – nur noch Ansicht")).toBeVisible();
    }
    await page.goto("/mitglieder/lager/orte");
    await clickUntil(page.getByRole("button", { name: `Aktionen für ${locationName}` }), () =>
      expect(page.getByRole("menuitem", { name: "Löschen" })).toBeVisible(),
    );
    await page.getByRole("menuitem", { name: "Löschen" }).click();
    await expect(page.getByRole("link", { name: new RegExp(locationName) })).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
