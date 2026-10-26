import { expect, test } from "@playwright/test";

import { authFile } from "./env";

// Finanzen (docs/Plan/finanzen-plan.md): Tabs, Einnahmen je Vorstellung, Berichte und Export.
// Nur lesend – bucht nichts, läuft also auch auf Staging.

const TABS = [
  ["eingang", "Eingang"],
  ["kassenbuch", "Kassenbuch"],
  ["einnahmen", "Einnahmen"],
  ["budgets", "Budgets"],
  ["berichte", "Berichte"],
  ["toepfe", "Töpfe"],
] as const;

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("alle Tabs laden", async ({ page }) => {
    for (const [tab, label] of TABS) {
      const response = await page.goto(`/mitglieder/finanzen?tab=${tab}`);
      expect(response?.status(), tab).toBeLessThan(400);
      await expect(page.getByRole("heading", { name: "Finanzen", level: 1 })).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Bereiche der Finanzen" }).getByText(label),
      ).toBeVisible();
    }
  });

  test("Berichte bieten PDF und CSV zum Herunterladen", async ({ page }) => {
    await page.goto("/mitglieder/finanzen?tab=berichte");
    const pdfLink = page.getByRole("link", { name: /Kassenbericht \(PDF\)/ });
    const csvLink = page.getByRole("link", { name: /Kassenbuch \(CSV\)/ });
    await expect(pdfLink).toBeVisible();

    const pdf = await page.request.get((await pdfLink.getAttribute("href"))!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    const csv = await page.request.get((await csvLink.getAttribute("href"))!);
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain('"Nr.";"Datum";"Art"');
  });
});

test.describe("als member", () => {
  test.use({ storageState: authFile("member") });

  test("ohne Finanzrecht kein Export und keine Berichte", async ({ page }) => {
    const response = await page.request.get("/api/finanzen/export?zeitraum=x&format=csv");
    expect(response.status()).toBe(403);
    await page.goto("/mitglieder/finanzen?tab=berichte");
    // Weiterleitung auf Meine Auslagen – oder, falls die Seite ausgeblendet ist, aufs Dashboard.
    await expect(page).not.toHaveURL(/tab=berichte/);
  });
});
