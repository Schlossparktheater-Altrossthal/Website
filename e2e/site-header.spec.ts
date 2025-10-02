import { expect, test } from "@playwright/test";

const SCROLL_DISTANCE = 600;

test.describe("Site Header", () => {
  test("elevates and animates like a SliverAppBar", async ({ page }) => {
    await page.goto("/");

    const header = page.locator('[data-testid="site-header"]');
    const title = page.locator('[data-testid="site-header-title"]');

    await expect(header).toBeVisible();
    await expect(title).toBeVisible();

    await expect(header).toHaveAttribute("data-elevated", "false");

    const initialShadow = await header.evaluate((node) =>
      window.getComputedStyle(node).boxShadow,
    );
    expect(initialShadow).toContain("0px 1px 2px");

    const initialTransform = await title.evaluate((node) =>
      window.getComputedStyle(node).transform,
    );

    await page.mouse.wheel(0, SCROLL_DISTANCE);

    await expect(header).toHaveAttribute("data-elevated", "true");
    await page.waitForTimeout(200);

    const elevatedShadow = await header.evaluate((node) =>
      window.getComputedStyle(node).boxShadow,
    );
    expect(elevatedShadow).toContain("10px 15px");

    const scrolledTransform = await title.evaluate((node) =>
      window.getComputedStyle(node).transform,
    );
    expect(scrolledTransform).not.toBe(initialTransform);
  });
});
