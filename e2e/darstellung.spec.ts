import { expect, test } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Theme-Seite und persönliche Darstellung im Profil (docs/Plan/theme-plan.md).

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Theme-Galerie und Editor laden ohne Fehler", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/mitglieder/website");
    await expect(page.getByRole("heading", { name: "Themes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Importieren" })).toBeVisible();
    await expect(page.getByText("Wichtigste Farben")).toBeVisible();
    await expect(page.getByRole("img", { name: /Vorschau/ })).toBeVisible();

    // Import-Dialog öffnen und wieder schließen
    await clickUntil(page.getByRole("button", { name: "Importieren" }), () =>
      expect(page.getByRole("dialog", { name: "Theme importieren" })).toBeVisible({
        timeout: 2_000,
      }),
    );
    await page.getByRole("button", { name: "Abbrechen" }).click();

    expect(errors).toEqual([]);
  });
});

test.describe("als member", () => {
  test.use({ storageState: authFile("member") });

  test("Farbmodus wird gespeichert und sofort angewendet", async ({ page }) => {
    await page.goto("/mitglieder/profil?bereich=darstellung");
    const group = page.getByRole("radiogroup", { name: "Farbmodus" });
    await expect(group).toBeVisible();
    // Den Modus wählen, der nicht schon Vorgabe der Seite ist – sonst ist er bereits
    // angehakt, der Klick speichert nichts (andere Tests stellen die Seite auf dunkel).
    const siteDark = /\bdark\b/.test((await page.locator("html").getAttribute("class")) ?? "");
    const target = siteDark ? "light" : "dark";
    const radio = group.getByRole("radio", { name: siteDark ? "Hell" : "Dunkel" });
    await clickUntil(radio, () => expect(radio).toBeChecked({ timeout: 2_000 }));
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", target);

    await expect
      .poll(async () => {
        const response = await page.request.get("/api/profile/appearance");
        return ((await response.json()) as { colorMode: string | null }).colorMode;
      })
      .toBe(target);

    // Nach dem Neuladen rendert schon der Server den gewählten Modus.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", target);

    // Zurück auf die Seitenvorgabe, damit wiederholte Läufe gleich starten
    const reset = await page.request.put("/api/profile/appearance", {
      data: { colorMode: null, themeId: null },
    });
    expect(reset.ok()).toBe(true);
  });

  test("nicht freigegebene Themes lassen sich nicht wählen", async ({ page }) => {
    await page.goto("/mitglieder/profil?bereich=darstellung");
    const response = await page.request.put("/api/profile/appearance", {
      data: { colorMode: null, themeId: "gibt-es-nicht" },
    });
    expect(response.status()).toBe(400);
  });
});
