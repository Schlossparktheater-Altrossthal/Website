import { expect, test } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Fotoerlaubnis als Stufen (docs/Plan/fotoerlaubnis-stufen-plan.md). Die Tests verändern keine
// Daten: Sie bedienen das Formular, schicken es aber nicht ab.

test.describe("Fotoerlaubnis im Profil", () => {
  test.use({ storageState: authFile("member") });

  test("zeigt Stufen als Auswahl und blendet den Nachweis nur bei Bedarf ein", async ({ page }) => {
    await page.goto("/mitglieder/profil?bereich=freigaben");

    const birthdateHint = page.getByText("Bitte trage zuerst dein Geburtsdatum ein.");
    const change = page.getByRole("button", {
      name: /^(Ändern|Neu abgeben|Unterschrift nachreichen|Stufe angeben)$/,
    });
    const levels = page.getByRole("radiogroup", { name: "Stufe der Fotoerlaubnis" });

    await expect(birthdateHint.or(change).or(levels)).toBeVisible();
    test.skip(await birthdateHint.isVisible(), "Testnutzer ohne Geburtsdatum");
    if (await change.isVisible()) {
      await clickUntil(change, () => expect(levels).toBeVisible({ timeout: 1_500 }));
    }

    const internal = levels.getByRole("radio", { name: /Nur intern/ });
    await internal.click();
    await expect(internal).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radiogroup", { name: "Art des Nachweises" })).toBeVisible();

    // „Gar nicht“ braucht keinen Nachweis.
    await levels.getByRole("radio", { name: /Gar nicht/ }).click();
    await expect(page.getByRole("radiogroup", { name: "Art des Nachweises" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Speichern", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Hinweis hinzufügen" }).click();
    await expect(page.getByLabel(/Hinweis/)).toBeVisible();
  });
});

test.describe("Fotoerlaubnisse in der Verwaltung", () => {
  test.use({ storageState: authFile("admin") });

  test("filtert über Zähler-Chips und zeigt die Fotoliste nach Stufen", async ({ page }) => {
    await page.goto("/mitglieder/fotoerlaubnisse");
    const buckets = page.getByRole("radiogroup", { name: "Bereich" });
    await expect(buckets).toBeVisible();
    await expect(buckets.getByRole("radio", { name: /^Zu prüfen: \d+$/ })).toBeVisible();
    await expect(buckets.getByRole("radio", { name: /^Erledigt: \d+$/ })).toBeVisible();

    await page.goto("/mitglieder/fotoerlaubnisse?bereich=fotografen");
    await expect(page.getByRole("textbox", { name: "Fotoliste durchsuchen" })).toBeVisible();
    await expect(page.getByText("Zwecke", { exact: true })).toHaveCount(0);
  });
});
