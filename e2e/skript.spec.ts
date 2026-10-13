import { expect, test, type Page } from "@playwright/test";

import { buildScriptPdf } from "../src/lib/skript/__tests__/fixture-pdf";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Skript (docs/Plan/skript-plan.md): kleines Test-PDF einlesen, Prüfschritt ansehen und den
// Entwurf wieder verwerfen. Rollen werden bewusst nicht bestätigt – bestätigte Skript-Rollen
// blieben sonst im Stück zurück.

const SKRIPT = "/mitglieder/produktionen/stueck?ansicht=skript";
const shots = process.env.E2E_SKRIPT_SCREENSHOTS;

async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const [label, width, height] of [
    ["desktop", 1280, 900],
    ["mobil", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${shots}/${name}-${label}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function discard(page: Page) {
  const button = page.getByRole("button", { name: "Verwerfen" });
  await clickUntil(button, () => expect(page.getByRole("dialog")).toBeVisible());
  await page.getByRole("dialog").getByRole("button", { name: "Verwerfen" }).click();
  await expect(page).not.toHaveURL(/fassung=/);
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("PDF einlesen, prüfen und Entwurf verwerfen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(SKRIPT);
    test.skip(
      await page
        .getByText("Keine aktive Produktion ausgewählt")
        .isVisible()
        .catch(() => false),
      "Testnutzer hat keine aktive Produktion",
    );
    await expect(page.getByText("Neue Fassung einlesen")).toBeVisible();
    // Reste abgebrochener Läufe aufräumen
    const leftover = page.getByRole("link", { name: /E2E Skript/ });
    while (await leftover.count()) {
      await leftover.first().click();
      await discard(page);
    }
    await shoot(page, "skript-liste");

    const label = `E2E Skript ${Date.now().toString(36)}`;
    const pdf = await buildScriptPdf([
      [
        [{ text: "SZENE 1 – E2E", style: "bold" }],
        [
          { text: "TON 1 Glocke", highlight: "#ffff00" },
          { text: " " },
          { text: "Auftritt.", style: "italic" },
        ],
        [{ text: "E2E Alpha:", style: "bold" }, { text: " Guten Abend." }],
        [{ text: "E2E Beta:", style: "bold" }, { text: " Hallo! Es ist anders – TON 2: Tür zu" }],
        [{ text: "E2E Alpha:", style: "bold" }, { text: " Wie geht es?" }],
        [{ text: "E2E Alfa:", style: "bold" }, { text: " Tschüss." }],
      ],
    ]);
    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-skript.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdf),
    });
    await page.getByLabel("Bezeichnung").fill(label);
    const submit = page.getByRole("button", { name: "Einlesen" });
    await clickUntil(submit, () => expect(page).toHaveURL(/fassung=/, { timeout: 2_000 }), {
      timeout: 90_000,
    });

    await expect(page.getByText(label).first()).toBeVisible();
    await expect(page.getByText("Unsichere Hinweise").first()).toBeVisible();
    await expect(page.getByText("E2E Alpha", { exact: true })).toBeVisible();
    await expect(page.getByText(/Tippfehler\? ähnlich/)).toBeVisible();
    // Tippfehler wird der ähnlichen Rolle dieser Fassung vorgeschlagen
    await expect(page.getByLabel("Skript-Rolle für E2E Alfa")).toHaveValue("same:E2E Alpha");
    await expect(page.getByRole("button", { name: "Freigeben" })).toBeDisabled();
    await shoot(page, "skript-pruefen");

    await discard(page);
    await expect(page.getByText(label)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
