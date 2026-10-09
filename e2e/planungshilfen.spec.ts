import { expect, test } from "@playwright/test";

import { clickUntil } from "./helpers";
import { authFile } from "./env";

// Planungshilfen der Terminplanung (docs/Plan/planungshilfen-terminplanung-plan.md):
// Tagesblatt mit „Was ist probbar?“ und Wochenbelastung, Ansichten Szenen und Personen.
// Nur lesend – legt nichts an, läuft also auch auf Staging.

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Ansichten Szenen und Personen", async ({ page }) => {
    await page.goto("/mitglieder/terminplanung");
    const scenes = page.getByRole("radio", { name: "Szenen" });
    test.skip((await scenes.count()) === 0, "Aktive Produktion ohne Szenen");

    await clickUntil(scenes, () => expect(page).toHaveURL(/ansicht=szenen/, { timeout: 2_000 }));
    await expect(page.getByText(/Bisher \d+ Szenenprobe/)).toBeVisible();

    await page.getByRole("radio", { name: "Personen" }).click();
    await expect(page).toHaveURL(/ansicht=personen/);
    await expect(page.getByRole("heading", { name: /^Woche / })).toBeVisible();
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await expect(page.getByRole("heading", { name: /^Woche / })).toBeVisible();
  });

  test("Tagesblatt zeigt probbare Szenen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/mitglieder/terminplanung");
    test.skip(
      (await page.getByRole("radio", { name: "Szenen" }).count()) === 0,
      "Aktive Produktion ohne Szenen",
    );
    await expect(page.getByText("Was ist probbar?")).toBeVisible();
    const add = page.getByRole("button", { name: /hinzufügen$/ }).first();
    await clickUntil(add, () =>
      expect(page.getByRole("button", { name: /Probe mit 1 Szene anlegen/ })).toBeVisible({
        timeout: 2_000,
      }),
    );
  });
});
