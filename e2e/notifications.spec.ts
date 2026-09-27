import { expect, test } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Glocke und Seite „Benachrichtigungen“ (docs/seiten/benachrichtigungen.md).

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Testbenachrichtigung erscheint in der Glocke und lässt sich archivieren", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/mitglieder");
    const session = await page.request.get("/api/auth/session");
    const userId = (await session.json())?.user?.id as string | undefined;
    test.skip(!userId, "Keine Session");

    const sent = await page.request.post("/api/notifications/test", {
      data: { userId, mode: "normal" },
    });
    test.skip(sent.status() === 403, "Testnutzer darf keine Testbenachrichtigung senden");
    expect(sent.ok()).toBeTruthy();

    const bell = page.getByTestId("notification-bell");
    const entry = page.getByText("Testbenachrichtigung", { exact: true }).first();
    await clickUntil(bell, () => expect(entry).toBeVisible({ timeout: 2_000 }));

    // Archivieren (Desktop: Knopf beim Überfahren, mobil per Wischen – hier der Knopf)
    const row = page.locator("[data-notification-group]").filter({ has: entry }).first();
    await row.hover();
    await row.getByRole("button", { name: "Archivieren" }).click({ force: true });
    await expect(row).toHaveCount(0);

    await page.goto("/mitglieder/benachrichtigungen");
    await page.getByRole("radio", { name: "Archiv" }).click();
    await expect(page.getByText("Testbenachrichtigung", { exact: true }).first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
