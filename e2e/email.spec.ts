import { expect, test } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// E-Mail-Versand: Admin-Seite, Mail-Einstellungen im Profil, Abmelden (docs/Plan/email-plan.md).
// Bewusst ohne Testmail: Die Testnutzer haben @example.com-Adressen.

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Seite E-Mail-Versand zeigt Zustand, Zugang, Absender und Verlauf", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/mitglieder/server-einstellungen");
    await expect(page.getByRole("heading", { name: "E-Mail-Versand", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Testmail an mich" })).toBeVisible();
    await expect(page.getByText("Zugang zum SMTP-Server")).toBeVisible();
    await expect(page.getByText("Versandverlauf")).toBeVisible();

    // Filter „Probleme“ umschalten, ohne dass etwas abstürzt
    await clickUntil(page.getByRole("radio", { name: "Probleme" }), () =>
      expect(page.getByRole("radio", { name: "Probleme" })).toBeChecked({ timeout: 2_000 }),
    );

    expect(errors).toEqual([]);
  });
});

test.describe("als member", () => {
  test.use({ storageState: authFile("member") });

  test("E-Mail je Bereich und Zusammenfassung werden gespeichert", async ({ page }) => {
    await page.goto("/mitglieder/profil?bereich=benachrichtigungen");
    const group = page.getByRole("radiogroup", { name: "E-Mail für Proben" });
    const instant = group.getByRole("radio", { name: "Sofort" });
    await clickUntil(instant, () => expect(instant).toBeChecked({ timeout: 2_000 }));

    // Gespeichert? Über die API prüfen, das Speichern läuft im Hintergrund.
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/notifications/preferences");
        const body = (await response.json()) as {
          categories: { category: string; emailMode: string }[];
        };
        return body.categories.find((entry) => entry.category === "proben")?.emailMode;
      })
      .toBe("instant");

    await page.reload();
    await expect(
      page.getByRole("radiogroup", { name: "E-Mail für Proben" }).getByRole("radio", {
        name: "Sofort",
      }),
    ).toBeChecked();

    // Zurück auf den Standard, damit wiederholte Läufe gleich starten
    const reset = await page.request.put("/api/notifications/preferences", {
      data: { category: "proben", emailMode: "digest" },
    });
    expect(reset.ok()).toBeTruthy();
    const digest = await page.request.put("/api/notifications/preferences", {
      data: { digest: "weekly" },
    });
    expect(digest.ok()).toBeTruthy();
    const back = await page.request.put("/api/notifications/preferences", {
      data: { digest: "daily" },
    });
    expect(back.ok()).toBeTruthy();
  });
});

test.describe("ohne Anmeldung", () => {
  test("Abmeldeseite lehnt ungültige Links ab, One-Click nur mit Signatur", async ({
    page,
    request,
  }) => {
    await page.goto("/email/abmelden?u=nobody&s=falsch");
    await expect(page.getByRole("heading", { name: "E-Mails abbestellen" })).toBeVisible();
    await expect(page.getByText("Der Link ist ungültig.")).toBeVisible();

    const post = await request.post("/api/email/unsubscribe?u=nobody&s=falsch");
    expect(post.status()).toBe(400);

    // GET meldet niemanden ab (Link-Scanner), sondern leitet zur Bestätigungsseite
    const get = await request.get("/api/email/unsubscribe?u=nobody&s=falsch", {
      maxRedirects: 0,
    });
    expect(get.status()).toBe(303);
    expect(get.headers().location).toContain("/email/abmelden?u=nobody");
  });
});
