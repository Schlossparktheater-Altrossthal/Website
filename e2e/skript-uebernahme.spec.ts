import { expect, test } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Skript ↔ Stück (docs/Plan/skript-uebernahme-plan.md): Reiter „Rollen“ und Übernahme-Assistent
// öffnen, Dialoge ansehen – nichts speichern, damit im Stück nichts zurückbleibt. Schreibende
// Wege decken die DB-Tests unter src/lib/skript/__tests__/*.db.manual.ts ab.

const SKRIPT = "/mitglieder/produktionen/stueck?ansicht=skript";

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Rollen zuordnen und Übernahme ansehen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(SKRIPT);
    const roles = page.getByRole("link", { name: /Rollen zuordnen/ });
    test.skip(!(await roles.count()), "Produktion ohne Skript-Fassung");

    await roles.click();
    await expect(page).toHaveURL(/bereich=rollen/);
    await expect(page.getByText("Rollen im Skript")).toBeVisible();
    const first = page
      .getByRole("button")
      .filter({ hasText: /Repliken|Fassung nicht/ })
      .first();
    if (await first.count()) {
      await clickUntil(first, () => expect(page.getByRole("dialog")).toBeVisible());
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Rolle im Stück")).toBeVisible();
      await expect(dialog.getByText("Zusammenführen").first()).toBeVisible();
      await dialog.getByRole("button", { name: "Abbrechen" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }

    await page.goto(SKRIPT);
    const takeover = page.getByRole("link", { name: /Ins Stück übernehmen/ });
    test.skip(!(await takeover.count()), "Keine freigegebene Fassung");
    await takeover.click();
    await expect(page).toHaveURL(/bereich=uebernahme/);
    await expect(page.getByText(/1 · Szenen/)).toBeVisible();
    await expect(page.getByText(/2 · Rollen/)).toBeVisible();
    await expect(page.getByText("3 · Auftritte")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
