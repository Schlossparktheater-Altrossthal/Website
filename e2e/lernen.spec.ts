import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Lernmodus (docs/Plan/lernmodus-plan.md): braucht eine freigegebene Fassung im aktiven Stück.
// Der Lernstand des Testnutzers wird am Ende über die Einstellungen wieder zurückgesetzt.

const SKRIPT = "/mitglieder/produktionen/stueck?ansicht=skript";
const shots = process.env.E2E_SKRIPT_SCREENSHOTS;

async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const [label, width, height] of [
    ["desktop", 1280, 900],
    ["mobil", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${shots}/${name}-${label}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/** Lernstand der Rolle über die Einstellungen zurücksetzen (Start und Ende des Tests). */
async function resetRole(page: Page, roleName: string) {
  await page.getByRole("button", { name: "Lern-Einstellungen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: roleName, exact: true }).click();
  await page.getByRole("button", { name: "Zurücksetzen" }).click();
  await expect(page.getByText("Lernstand zurückgesetzt").first()).toBeVisible();
  // Bestätigung und Einstellungen schließen (je ein Escape, bis kein Dialog mehr offen ist).
  await expect(async () => {
    if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Dashboard, Abfrage und Szenenfluss", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(SKRIPT);
    const entry = page.getByRole("link", { name: /Text lernen/ });
    test.skip(!(await entry.isVisible().catch(() => false)), "Keine freigegebene Fassung");
    await clickUntil(entry, () => expect(page).toHaveURL(/\/mitglieder\/lernen\//));
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    // Rolle wählen: die mit den meisten Wörtern (steht oben, falls keine eigene)
    await clickUntil(page.getByTestId("lernen-rollen"), () =>
      expect(page.getByRole("dialog")).toBeVisible(),
    );
    const dialog = page.getByRole("dialog");
    const first = dialog.getByRole("checkbox").first();
    if (!(await first.isChecked())) await first.click();
    const roleName = (await dialog.locator("label .font-medium").first().innerText())
      .split("\n")[0]
      .replace(/deine Rolle$/, "")
      .trim();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("lernen-heute")).toBeVisible();
    // Reste abgebrochener Läufe entfernen, damit neue Stellen fällig sind.
    await resetRole(page, roleName);
    await expect(page.getByTestId("lernen-szene").first()).toBeVisible();
    await shoot(page, "lernen-dashboard");

    // Abfrage: einmal ohne Tipp prüfen (Vorschlag „Gut“), einmal mit Tipp und selbst bewerten
    await page.getByRole("button", { name: /Abfrage starten|Mehr lernen/ }).click();
    await expect(page.getByTestId("lernen-karte")).toBeVisible();
    await shoot(page, "lernen-abfrage");
    const group = page.getByRole("group", { name: "Wie gut saß es?" });
    await page.getByRole("button", { name: /Aufdecken & prüfen/ }).click();
    await expect(group).toBeVisible();
    await expect(page.getByTestId("lernen-vorschlag")).toContainText("Ohne Tipps");
    await group.getByRole("button", { name: /^Gut/ }).click();
    const tip = page.getByRole("button", { name: "Tipp", exact: true });
    if (await tip.isEnabled()) await tip.click();
    await page.getByRole("button", { name: /Aufdecken & prüfen/ }).click();
    await expect(group).toBeVisible();
    await shoot(page, "lernen-abfrage-bewerten");
    await group.getByRole("button", { name: /^Schwer/ }).click();
    await page.getByRole("button", { name: "Zurück zur Übersicht" }).click();
    await expect(page.getByTestId("lernen-heute")).toBeVisible();

    // Szenenfluss: Wort antippen, weiter
    await page.getByTestId("lernen-szene").first().click();
    const current = page.locator("[data-current]");
    await expect(current).toBeVisible();
    const masked = current.locator("[data-masked-word]").first();
    if (await masked.count()) await masked.click();
    await shoot(page, "lernen-fluss");
    // Gerade in der Abfrage bewertete Stellen sind nicht fällig und werden im Fluss nur geübt;
    // weiter bis zur ersten bewerteten Stelle (Korrekturleiste erscheint).
    const correction = page.getByTestId("lernen-korrektur");
    for (let i = 0; i < 6 && !(await correction.isVisible()); i++) {
      const word = page.locator("[data-current] [data-masked-word]").first();
      if (await word.count()) await word.click();
      await page.getByRole("button", { name: /^Weiter/ }).click();
    }
    await expect(correction).toBeVisible();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Zurück zur Übersicht" }).click();

    // Gesamtstand und Statistik
    await page.getByTestId("lernen-ueberblick").click();
    await expect(page.getByTestId("lernen-statistik")).toBeVisible();
    await shoot(page, "lernen-statistik");
    await page.getByRole("button", { name: "Zurück zur Übersicht" }).click();
    await expect(page.getByTestId("lernen-heute")).toBeVisible();

    // Aufräumen: erst alles gespeichert, dann Lernstand der Rolle zurücksetzen
    await expect(page.getByText(/\d+ offen/)).toHaveCount(0, { timeout: 30_000 });
    await page.getByRole("button", { name: "Lern-Einstellungen" }).click();
    await shoot(page, "lernen-einstellungen");
    await page.keyboard.press("Escape");
    await resetRole(page, roleName);
    expect(errors).toEqual([]);
  });
});
