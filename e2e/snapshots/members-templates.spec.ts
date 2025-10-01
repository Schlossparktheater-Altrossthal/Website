import { expect, test } from "@playwright/test";

const storybookBaseUrl = process.env.STORYBOOK_BASE_URL;

test.describe("members templates visual snapshots", () => {
  test.skip(!storybookBaseUrl, "STORYBOOK_BASE_URL is not configured for template snapshots");

  test("list page story renders", async ({ page }) => {
    await page.goto(`${storybookBaseUrl}/iframe.html?id=members-templates-overview--list-page&viewMode=story`);
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot("members-templates-list.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
