import { expect, test } from "@playwright/test";

import { clickUntil } from "./helpers";
import { authFile } from "./env";

// Regie-Dashboard (docs/Plan/regie-plan.md): Karten, Lese-Ansichten, PDFs, Probenmappe und
// Wunsch-Eingabe. Nur lesend – schickt keinen Wunsch ab, läuft also auch auf Staging.

const VIEWS = [
  ["proben", "Proben"],
  ["szenen", "Szenen"],
  ["verfuegbarkeit", "Verfügbarkeit"],
  ["besetzung", "Besetzung"],
  ["protokolle", "Probenprotokolle"],
  ["ausstattung", "Ausstattung"],
  ["wuensche", "Wünsche"],
] as const;

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Dashboard zeigt die Karten", async ({ page }) => {
    await page.goto("/mitglieder/regie");
    await expect(page.getByRole("heading", { name: "Regie", level: 1 })).toBeVisible();
    for (const title of [
      "Wünsche an die Planung",
      "Nächste Proben",
      "Probenmappe",
      "Szenen × Personen",
      "Verfügbarkeit",
      "Besetzung",
    ]) {
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
  });

  test("Lese-Ansichten laden", async ({ page }) => {
    for (const [path, heading] of VIEWS) {
      const response = await page.goto(`/mitglieder/regie/${path}`);
      expect(response?.status(), path).toBeLessThan(400);
      await expect(
        page.getByRole("heading", { name: new RegExp(heading), level: 1 }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /Regie-Übersicht/ })).toBeVisible();
    }
  });

  test("Wunsch-Eingabe öffnet und verlangt Text", async ({ page }) => {
    await page.goto("/mitglieder/regie");
    await clickUntil(page.getByRole("button", { name: "Neuer Wunsch" }), () =>
      expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
    );
    const send = page.getByRole("dialog").getByRole("button", { name: "Senden" });
    await expect(send).toBeDisabled();
    await page.getByRole("dialog").getByLabel("Wunsch").fill("Test – nicht senden");
    await expect(send).toBeEnabled();
    await page.getByRole("dialog").getByRole("button", { name: "Abbrechen" }).click();
  });

  test("Probenmappe: Auswahl ohne Skript, PDF mit Deckblatt", async ({ page }) => {
    await page.goto("/mitglieder/regie");
    await clickUntil(page.getByRole("button", { name: "Probenmappe erstellen" }), () =>
      expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
    );
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Besetzung")).toBeVisible();
    await expect(dialog.getByText(/Skript/)).toHaveCount(0);

    const href = await dialog.getByRole("link", { name: "PDF öffnen" }).getAttribute("href");
    expect(href).toMatch(/\/pdf\/mappe\?teile=/);
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  });

  test("Einzel-PDFs", async ({ page }) => {
    await page.goto("/mitglieder/regie");
    const links = page.getByRole("link", { name: "PDF", exact: true });
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const href = await links.nth(index).getAttribute("href");
      const response = await page.request.get(href!);
      expect(response.status(), href!).toBe(200);
      expect(response.headers()["content-type"]).toBe("application/pdf");
    }
  });

  test("Planung sieht die Regie-Wünsche", async ({ page }) => {
    const response = await page.goto("/mitglieder/terminplanung/regie-wuensche");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
