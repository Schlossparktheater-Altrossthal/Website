import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";

// Kalender-Gesten (docs/Plan/kalender-gesten-plan.md): Wischen wechselt den Monat, Halten + Ziehen
// und Strg/Shift-Klick wählen mehrere Tage in der Sperrliste. Die Tests speichern nichts.

const MONTH = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

/** Tag im nächsten Monat (yyyy-MM-dd) – liegt sicher in der Zukunft. */
function nextMonthDay(day: number) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day, 12));
  return date.toISOString().slice(0, 10);
}
const nextMonthLabel = () => MONTH.format(new Date(`${nextMonthDay(15)}T12:00:00Z`));

const grid = (page: Page) => page.getByRole("grid").first();
const cell = (page: Page, key: string) => page.locator(`[role=grid] [data-date="${key}"]`);
const selectedKeys = (page: Page) =>
  page
    .locator("[role=gridcell][aria-selected=true]")
    .evaluateAll((cells) => cells.map((element) => (element as HTMLElement).dataset.date));

async function openNextMonth(page: Page) {
  await page.goto("/mitglieder/sperrliste");
  await expect(grid(page)).toBeVisible();
  await page.getByRole("button", { name: "Nächster Monat" }).click();
  await expect(grid(page)).toHaveAttribute("aria-label", nextMonthLabel());
}

test.describe("Kalender am Desktop", () => {
  test.use({ storageState: authFile("admin") });

  test("Ziehen, Shift- und Strg-Klick, Esc", async ({ page }) => {
    await openNextMonth(page);
    const from = await cell(page, nextMonthDay(10)).boundingBox();
    const to = await cell(page, nextMonthDay(12)).boundingBox();
    if (!from || !to) throw new Error("Tage nicht sichtbar");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => selectedKeys(page)).toEqual([10, 11, 12].map(nextMonthDay));

    await cell(page, nextMonthDay(14)).click({ modifiers: ["Shift"] });
    await expect.poll(() => selectedKeys(page)).toHaveLength(5);
    await cell(page, nextMonthDay(11)).click({ modifiers: ["ControlOrMeta"] });
    await expect.poll(() => selectedKeys(page)).toHaveLength(4);
    await expect(page.getByText("4 Tage ausgewählt")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Mehrere Tage eintragen" })).toBeHidden();
  });

  test("Pfeiltasten und Bild↑", async ({ page }) => {
    await openNextMonth(page);
    await cell(page, nextMonthDay(10)).focus();
    await page.keyboard.press("ArrowDown");
    await expect(cell(page, nextMonthDay(17))).toBeFocused();
    await page.keyboard.press("PageUp");
    await expect(grid(page)).not.toHaveAttribute("aria-label", nextMonthLabel());
  });
});

test.describe("Kalender mobil", () => {
  test.use({
    storageState: authFile("admin"),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  async function touch(page: Page, points: { x: number; y: number }[], holdMs = 0) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type: string, point?: { x: number; y: number }) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [point] : [] });
    await send("touchStart", points[0]);
    if (holdMs) await page.waitForTimeout(holdMs);
    for (const point of points.slice(1)) {
      await send("touchMove", point);
      await page.waitForTimeout(20);
    }
    await send("touchEnd");
  }

  const centerOf = async (page: Page, key: string) => {
    const box = await cell(page, key).boundingBox();
    if (!box) throw new Error(`${key} nicht sichtbar`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  test("Wischen wechselt den Monat, senkrecht nicht", async ({ browserName, page }) => {
    test.skip(browserName !== "chromium", "Touch-Ereignisse per CDP nur in Chromium");
    await openNextMonth(page);
    const { x, y } = await centerOf(page, nextMonthDay(15));
    const path = (dx: number, dy: number) =>
      Array.from({ length: 9 }, (_, index) => ({
        x: x + (dx * index) / 8,
        y: y + (dy * index) / 8,
      }));

    await touch(page, path(0, -100));
    await expect(grid(page)).toHaveAttribute("aria-label", nextMonthLabel());
    await touch(page, path(160, 0));
    await expect(grid(page)).not.toHaveAttribute("aria-label", nextMonthLabel());
    await touch(page, path(-160, 0));
    await expect(grid(page)).toHaveAttribute("aria-label", nextMonthLabel());
  });

  test("Halten und Ziehen wählt einen Zeitraum, Tippen schaltet ab", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", "Touch-Ereignisse per CDP nur in Chromium");
    await openNextMonth(page);
    const start = await centerOf(page, nextMonthDay(10));
    const end = await centerOf(page, nextMonthDay(12));
    const steps = Array.from({ length: 9 }, (_, index) => ({
      x: start.x + ((end.x - start.x) * index) / 8,
      y: start.y + ((end.y - start.y) * index) / 8,
    }));
    await touch(page, steps, 650);
    await expect.poll(() => selectedKeys(page)).toEqual([10, 11, 12].map(nextMonthDay));
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.touchscreen.tap(end.x, end.y);
    await expect.poll(() => selectedKeys(page)).toHaveLength(2);
  });
});
