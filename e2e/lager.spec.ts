import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Lager (docs/Plan/inventar-plan.md): Lagerort und Objekte anlegen, scannen, Mangel und Prüfung,
// Etiketten-PDF, öffentliche Scan-Seite – und am Ende alles ausmustern bzw. löschen.
// Alle Daten tragen das Präfix „E2E“.

const stamp = Date.now().toString(36);

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function createAsset(page: Page, name: string, kind: "Einzelstück" | "Kiste", place: string) {
  await page.goto("/mitglieder/lager/neu");
  await clickUntil(page.getByRole("button", { name: /Technik/ }).first(), () =>
    expect(page.getByRole("button", { name: /Technik/ }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  await page
    .getByRole("radio", { name: kind === "Kiste" ? "Kiste / Case" : "Einzelstück" })
    .click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("combobox", { name: "Lagerort" }).click();
  await page.getByRole("option", { name: new RegExp(place) }).click();
  await page.getByRole("button", { name: /Speichern & weiter/ }).click();
  const banner = page.getByText(/^T-\d{4,} angelegt – gleich das nächste/);
  await expect(banner).toBeVisible({ timeout: 20_000 });
  const code = (await banner.textContent())?.match(/T-\d{4,}/)?.[0];
  expect(code).toBeTruthy();
  return code!;
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
    const locationCode = (await locationLink.textContent())?.match(/L-\d{4,}/)?.[0];
    expect(locationCode).toBeTruthy();

    // Kiste und Gerät erfassen.
    const boxCode = await createAsset(page, boxName, "Kiste", locationName);
    const itemCode = await createAsset(page, itemName, "Einzelstück", locationName);

    // Scanner, Modus Einlagern: erst Kiste als Ziel, dann das Gerät (Eingabe statt Kamera).
    await page.goto("/mitglieder/lager/scannen?modus=einlagern");
    const manualInput = page.getByLabel("Code eingeben");
    if (!(await manualInput.isVisible().catch(() => false))) {
      await clickUntil(page.getByRole("button", { name: "Code eintippen" }), () =>
        expect(manualInput).toBeVisible(),
      );
    }
    await manualInput.fill(boxCode);
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
        codes: [itemCode, boxCode, locationCode],
        templateId: "70x36",
        skip: 2,
        outlines: true,
        markPrinted: false,
        content: { showName: true, showArea: true, showInspection: true, showOrganisation: true },
      },
    });
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");

    // Öffentliche Scan-Seite ohne Login: Name ja, keine internen Daten.
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`/i/${itemCode}`);
    await expect(publicPage.getByRole("heading", { name: itemName })).toBeVisible();
    await expect(publicPage.getByText(/Anschaffung|Interne Notiz/)).toHaveCount(0);
    await anonymous.close();

    // Aufräumen: ausmustern, dann Lagerort löschen.
    for (const code of [itemCode, boxCode]) {
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
