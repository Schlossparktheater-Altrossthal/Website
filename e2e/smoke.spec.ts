import { expect, test } from "@playwright/test";

import { E2E_ROLES, authFile } from "./env";

// Grundcheck je Rolle: angemeldet im Mitgliederbereich, keine Weiterleitung zum Login.
for (const role of E2E_ROLES) {
  test.describe(`als ${role}`, () => {
    test.use({ storageState: authFile(role) });

    test("Mitgliederbereich öffnet sich angemeldet", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("/mitglieder");
      await expect(page).toHaveURL(/\/mitglieder/);
      await expect(page).not.toHaveURL(/\/login/);
      expect(errors).toEqual([]);
    });
  });
}
