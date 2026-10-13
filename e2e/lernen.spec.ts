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

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Dashboard, Abfrage und Szenenfluss", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(SKRIPT);
    const entry = page.getByRole("link", { name: /Text lernen/ });
    test.skip(!(await entry.isVisible().catch(() => false)), "Keine freigegebene Fassung");
    await entry.click();
    await expect(page).toHaveURL(/\/mitglieder\/lernen\//);
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
    await expect(page.getByTestId("lernen-szene").first()).toBeVisible();
    await shoot(page, "lernen-dashboard");

    // Abfrage: einmal „Gewusst“, einmal aufdecken und bewerten
    await page.getByRole("button", { name: /Abfrage starten|Mehr lernen/ }).click();
    await expect(page.getByTestId("lernen-karte")).toBeVisible();
    await shoot(page, "lernen-abfrage");
    await page.getByRole("button", { name: "Gewusst" }).click();
    await expect(page.getByTestId("lernen-korrektur")).toBeVisible();
    await page.getByRole("button", { name: "Wort", exact: true }).click();
    await page.getByRole("button", { name: "Alles", exact: true }).click();
    const group = page.getByRole("group", { name: "Wie gut saß es?" });
    await expect(group).toBeVisible();
    await shoot(page, "lernen-abfrage-bewerten");
    await group.getByRole("button", { name: /Schwer/ }).click();
    await page.getByRole("button", { name: "Zurück zur Übersicht" }).click();
    await expect(page.getByTestId("lernen-heute")).toBeVisible();

    // Szenenfluss: Wort antippen, weiter
    await page.getByTestId("lernen-szene").first().click();
    const current = page.locator("[data-current]");
    await expect(current).toBeVisible();
    const masked = current.locator("[data-masked-word]").first();
    if (await masked.count()) await masked.click();
    await shoot(page, "lernen-fluss");
    await page.getByRole("button", { name: /^Weiter/ }).click();
    await expect(page.getByTestId("lernen-korrektur")).toBeVisible();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Zurück zur Übersicht" }).click();

    // Aufräumen: erst alles gespeichert, dann Lernstand der Rolle zurücksetzen
    await expect(page.getByText(/\d+ offen/)).toHaveCount(0, { timeout: 30_000 });
    await page.getByRole("button", { name: "Lern-Einstellungen" }).click();
    await shoot(page, "lernen-einstellungen");
    await page.getByRole("dialog").getByRole("button", { name: roleName, exact: true }).click();
    await page.getByRole("button", { name: "Zurücksetzen" }).click();
    await expect(page.getByText("Lernstand zurückgesetzt")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
