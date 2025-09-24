import { expect, test } from "@playwright/test";

const isConfigured = Boolean(process.env.SCAN_E2E_BASE_URL);

test.describe("offline scan sync flow", () => {
  test.skip(!isConfigured, "SCAN_E2E_BASE_URL is not configured for Playwright tests");

  test("queues ticket check-ins offline and syncs after reconnect", async ({ page }) => {
    await page.goto("/members/scan");
    await expect(page.getByRole("heading", { name: "Scanner" })).toBeVisible();

    await test.step("switch to ticket mode", async () => {
      await page.getByRole("tab", { name: "Tickets" }).click();
      await expect(page.locator("text=Ticket offline vorgemerkt")).toHaveCount(0);
    });

    await test.step("simulate offline check-in", async () => {
      await page.context().setOffline(true);
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.setAttribute("data-test", "scan-mock");
        document.body.appendChild(input);
        input.dispatchEvent(new Event("scan"));
      });
      await expect(page.getByText(/offline vorgemerkt/i)).toBeVisible();
    });

    await test.step("flush queue after going online", async () => {
      await page.context().setOffline(false);
      await page.getByRole("button", { name: "Sync senden" }).click();
      await expect(page.getByText(/Sync gestartet/i)).toBeVisible();
    });
  });
});
