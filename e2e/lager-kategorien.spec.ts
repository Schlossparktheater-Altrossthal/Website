import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Lager 3 (docs/Plan/lager-kategorien-plan.md): geerbtes Merkmal abwählen, Kategorie-Auswahl mit
// Suche, Maße in einem Feld, Tags, Filter „passt in“ und Codes mit Unternummer (B-12-1).
// Setzt die Vorlagen der Migration voraus (Technik › Ton › Mikrofone › Kondensator,
// Merkmal „Gewicht“ in Technik, „Maße“ in Bühnenbau). Alle Daten tragen das Präfix „E2E“.

const stamp = Date.now().toString(36);

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openKondensator(page: Page) {
  await page.goto("/mitglieder/lager/katalog");
  await page.getByRole("tab", { name: /Technik/ }).click();
  const kondensator = page.getByRole("button", { name: /^Kondensator/ });
  if (!(await kondensator.isVisible())) {
    await page.getByRole("button", { name: "Mikrofone aufklappen" }).click();
  }
  await clickUntil(kondensator, () => expect(page.getByRole("dialog")).toBeVisible());
}

async function setGewicht(page: Page, on: boolean) {
  await openKondensator(page);
  const toggle = page.getByRole("switch", { name: "Gewicht hier verwenden" });
  if ((await toggle.getAttribute("aria-checked")) !== String(on)) {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", String(on));
  }
  await page.keyboard.press("Escape");
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "serial" });

  test("Kategorien: Merkmal abwählen und Auswahl per Suche", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await collectErrors(page);
    await setGewicht(page, false);
    try {
      await page.goto("/mitglieder/lager/neu");
      await page.getByLabel("Was möchtest du erfassen?").fill(`E2E Mikro ${stamp}`);
      await clickUntil(page.getByRole("button", { name: /^Neuer Artikeltyp/ }), () =>
        expect(page.getByText("Neuer Artikeltyp", { exact: true })).toBeVisible(),
      );
      // Technik ist vorbelegt: Gewicht steht da, bis Kondensator gewählt ist.
      await expect(page.getByLabel(/^Gewicht/)).toBeVisible();
      await page.getByRole("button", { name: "Kategorie" }).click();
      await page.getByPlaceholder(/Suchen, z\. B\./).fill("kondens");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Kondensator/ })
        .click();
      await expect(page.getByRole("button", { name: "Kategorie" })).toContainText("Kondensator");
      await expect(
        page
          .getByLabel(/^Richtcharakteristik/)
          .or(page.getByText("Richtcharakteristik"))
          .first(),
      ).toBeVisible();
      await expect(page.getByLabel(/^Gewicht/)).toHaveCount(0);
    } finally {
      await setGewicht(page, true);
    }
    expect(errors).toEqual([]);
  });

  test("Maße, Tags, Filter „passt in“ und Code mit Unternummer", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await collectErrors(page);
    const name = `E2E Podest ${stamp}`;
    const tag = `E2E-${stamp}`;

    await page.goto("/mitglieder/lager/neu");
    await page.getByLabel("Was möchtest du erfassen?").fill(name);
    await clickUntil(page.getByRole("button", { name: `Neuer Artikeltyp „${name}“` }), () =>
      expect(page.getByText("Neuer Artikeltyp", { exact: true })).toBeVisible(),
    );
    await page.getByRole("button", { name: "Kategorie" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: /Bühnenbau/ })
      .first()
      .click();
    await dialog.getByRole("button", { name: "Ohne Kategorie" }).click();
    await expect(page.getByRole("button", { name: "Kategorie" })).toContainText("Bühnenbau");

    await page.getByLabel(/^Maße/).fill("1,2m x 80 x 40");
    await expect(page.getByText("L 120 · B 80 · H 40 cm")).toBeVisible();
    await page.getByLabel("Tags").fill(`${tag},`);
    await expect(page.getByRole("button", { name: `Tag ${tag} entfernen` })).toBeVisible();
    await page.getByLabel("Anzahl").fill("2");
    await page.getByRole("button", { name: /anlegen$|^Anlegen$/ }).click();
    const range = page.locator("p.text-sm .font-mono").first();
    await expect(range).toBeVisible({ timeout: 20_000 });
    const codes = (await range.textContent())?.match(/B-\d+-\d+/g) ?? [];
    expect(codes).toHaveLength(2);
    const [, type] = codes[0]!.match(/^B-(\d+)-1$/)!;
    expect(codes[1]).toBe(`B-${type}-2`);

    // Filter: Tag + passt in – gedreht passt es, zu klein nicht.
    const list = (fits: string) =>
      `/mitglieder/lager?tag=${encodeURIComponent(tag)}&passt=${encodeURIComponent(fits)}`;
    await page.goto(list("50x130x90"));
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByRole("button", { name: /Filter passt in/ })).toBeVisible();
    await page.goto(list("100x80x40"));
    await expect(page.getByText(name)).toHaveCount(0);

    // Typ-Seite zeigt Maße und Tag; Code-Suche ohne Nullen/Striche findet das Exemplar.
    await page.goto(`/mitglieder/lager?q=${encodeURIComponent(name)}`);
    await page.getByText(name).first().click();
    await expect(page.getByText("120 × 80 × 40 cm")).toBeVisible();
    await expect(page.getByRole("link", { name: tag })).toBeVisible();

    // Aufräumen.
    for (const code of codes) {
      await page.goto(`/mitglieder/lager/objekt/${code}`);
      await clickUntil(page.getByRole("button", { name: "Weitere Aktionen" }), () =>
        expect(page.getByRole("menuitem", { name: "Ausmustern" })).toBeVisible(),
      );
      await page.getByRole("menuitem", { name: "Ausmustern" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Ausmustern" }).click();
      await expect(page.getByText("Ausgemustert – nur noch Ansicht")).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});
