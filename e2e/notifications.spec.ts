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

    // Nur Zeilen der Glocke: Der Text kann in der vollen Suite auch anderswo auf der Seite
    // stehen, und eine Wiederholung findet sonst die Zeile des vorherigen Versuchs.
    const bell = page.getByTestId("notification-bell");
    const row = page
      .locator("[data-notification-group]")
      .filter({ has: page.getByText("Testbenachrichtigung", { exact: true }) })
      .first();
    await clickUntil(bell, () => expect(row).toBeVisible({ timeout: 2_000 }));
    const groupKey = await row.getAttribute("data-notification-group");
    expect(groupKey).toBeTruthy();
    const archivedRow = page.locator(`[data-notification-group="${groupKey}"]`);

    // Archivieren (Desktop: Knopf beim Überfahren, mobil per Wischen – hier der Knopf)
    await archivedRow.hover();
    await archivedRow.getByRole("button", { name: "Archivieren" }).click({ force: true });
    await expect(archivedRow).toHaveCount(0);

    await page.goto("/mitglieder/benachrichtigungen");
    await clickUntil(page.getByRole("radio", { name: "Archiv" }), () =>
      expect(page.getByText("Testbenachrichtigung", { exact: true }).first()).toBeVisible({
        timeout: 2_000,
      }),
    );

    expect(errors).toEqual([]);
  });
});
