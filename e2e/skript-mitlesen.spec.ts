import { expect, test, type Browser, type Page } from "@playwright/test";

import { buildScriptPdf } from "../src/lib/skript/__tests__/fixture-pdf";

import { E2E_LOGIN_SECRET, authFile } from "./env";
import { clickUntil } from "./helpers";

// Live-Mitlesen (docs/Plan/skript-mitlesen-plan.md, Phase 5): admin führt am Desktop, owner folgt
// mobil – einer Person, automatisch, mit Pause und „Live ↓“. Danach sieht die Führung, wer
// abgehängt ist. Braucht den Realtime-Server (CI startet ihn neben next dev).

const SKRIPT = "/mitglieder/produktionen/stueck?ansicht=skript";
const LINES = 80;

/** Zweite Person in eigenem Kontext (eigene Session, wie ein zweites Gerät). */
async function openAs(browser: Browser, role: string, mobile: boolean) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  const response = await context.request.get(`/api/dev/screenshot-session?role=${role}&mode=json`, {
    headers: E2E_LOGIN_SECRET ? { "x-e2e-login-secret": E2E_LOGIN_SECRET } : {},
    maxRedirects: 0,
  });
  expect(response.status(), await response.text()).toBe(200);
  return context;
}

/** Absatz-Index an der Lesezeile (ca. 40 % Höhe). */
function lineBlock(page: Page) {
  return page.evaluate(() => {
    const y = innerHeight * 0.4;
    const blocks = [...document.querySelectorAll("[data-block]")];
    let hit = -1;
    blocks.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.height && rect.top <= y) hit = index;
    });
    return hit;
  });
}

function scrollToBlock(page: Page, index: number) {
  return page.evaluate((i) => {
    document.querySelectorAll("[data-block]")[i]?.scrollIntoView({ block: "center" });
  }, index);
}

async function openReader(page: Page, versionId: string) {
  await page.goto(`/mitglieder/skript/${versionId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Satz Nummer 1,", { exact: false }).first()).toBeVisible({
    timeout: 60_000,
  });
}

/** Ansicht → „Gemeinsam mitlesen“; lässt das Mitlesen-Sheet offen. */
async function joinLive(page: Page) {
  await clickUntil(page.getByRole("button", { name: "Ansicht einstellen" }), () =>
    expect(page.getByRole("dialog")).toBeVisible(),
  );
  await page.getByRole("switch", { name: "Gemeinsam mitlesen" }).click();
  await expect(page.getByRole("dialog", { name: "Mitlesen" })).toBeVisible();
}

async function discard(page: Page) {
  const button = page.getByRole("button", { name: "Verwerfen" });
  await clickUntil(button, () => expect(page.getByRole("dialog")).toBeVisible());
  await page.getByRole("dialog").getByRole("button", { name: "Verwerfen" }).click();
  await expect(page).not.toHaveURL(/fassung=/, { timeout: 30_000 });
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Mitlesen: Person folgen, automatisch, Abgehängte", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(SKRIPT);
    test.skip(
      await page
        .getByText("Keine Produktion ausgewählt")
        .isVisible()
        .catch(() => false),
      "Testnutzer hat keine Produktion ausgewählt",
    );
    const leftover = page.getByRole("link", { name: /E2E Mitlesen/ });
    while (await leftover.count()) {
      await leftover.first().click();
      await discard(page);
    }

    const label = `E2E Mitlesen ${Date.now().toString(36)}`;
    const pdf = await buildScriptPdf([
      [
        [{ text: "SZENE 1 – Mitlesen", style: "bold" }],
        ...Array.from({ length: LINES }, (_, index) => [
          { text: index % 2 ? "E2E Beta:" : "E2E Alpha:", style: "bold" as const },
          { text: ` Satz Nummer ${index + 1}, lang genug, damit der Leser scrollen muss.` },
        ]),
      ],
    ]);
    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-mitlesen.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdf),
    });
    await page.getByLabel("Bezeichnung").fill(label);
    await clickUntil(
      page.getByRole("button", { name: "Einlesen" }),
      () => expect(page).toHaveURL(/fassung=/, { timeout: 2_000 }),
      { timeout: 90_000 },
    );
    const versionId = new URL(page.url()).searchParams.get("fassung") ?? "";
    expect(versionId).not.toBe("");

    const ownerContext = await openAs(browser, "owner", true);
    const follower = await ownerContext.newPage();
    follower.on("pageerror", (error) => errors.push(error.message));
    try {
      // Führung: admin am Desktop teilt die Lesestelle.
      await page.setViewportSize({ width: 1280, height: 900 });
      await openReader(page, versionId);
      await joinLive(page);
      const sheet = page.getByRole("dialog", { name: "Mitlesen" });
      await sheet.getByRole("switch", { name: "Andere dürfen mir folgen" }).click();
      await page.keyboard.press("Escape");
      await expect(page.getByText("Andere können dir folgen")).toBeVisible();
      await scrollToBlock(page, 10);

      // owner folgt mobil der Person.
      await openReader(follower, versionId);
      await joinLive(follower);
      const followerSheet = follower.getByRole("dialog", { name: "Mitlesen" });
      await expect(followerSheet.getByText(/2 Personen lesen gerade mit/)).toBeVisible({
        timeout: 20_000,
      });
      const leaderButton = followerSheet
        .getByRole("listitem")
        .getByRole("button", { name: /Folgen$/ })
        .first();
      await leaderButton.click();
      await expect(follower.getByRole("button", { name: /^Folge (?!ich)/ })).toBeVisible();

      // Führung scrollt weiter → Folgende landet an derselben Stelle.
      await scrollToBlock(page, 40);
      await expect
        .poll(async () => Math.abs((await lineBlock(follower)) - (await lineBlock(page))), {
          timeout: 15_000,
        })
        .toBeLessThanOrEqual(2);

      // Eigenes Scrollen pausiert, „Live ↓“ holt zurück.
      await follower.evaluate(() => window.scrollTo(0, 0));
      await follower.mouse.wheel(0, -200);
      const back = follower.getByRole("button", { name: /^Live ↓/ });
      await expect(back).toBeVisible({ timeout: 10_000 });
      await back.click();
      await expect
        .poll(async () => Math.abs((await lineBlock(follower)) - (await lineBlock(page))), {
          timeout: 15_000,
        })
        .toBeLessThanOrEqual(2);

      // Automatisch: Stelle aus allen Mitlesenden (Führung zählt dreifach → reicht allein).
      await follower.getByRole("button", { name: /^Folge (?!ich)/ }).click();
      const autoSheet = follower.getByRole("dialog", { name: "Mitlesen" });
      await autoSheet.getByRole("button", { name: /^Automatisch/ }).click();
      await expect(follower.getByRole("button", { name: /^Folge automatisch/ })).toBeVisible();
      await scrollToBlock(page, 60);
      await expect
        .poll(async () => Math.abs((await lineBlock(follower)) - (await lineBlock(page))), {
          timeout: 20_000,
        })
        .toBeLessThanOrEqual(3);

      // Folgen beenden, zurück an den Anfang → die Führung sieht „1 abgehängt“ (E7).
      await follower.getByRole("button", { name: "Beenden" }).click();
      await follower.evaluate(() => window.scrollTo(0, 0));
      await follower.mouse.wheel(0, 50);
      await scrollToBlock(page, 62);
      await expect(page.getByText("1 abgehängt")).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: /Andere können dir folgen/ }).click();
      const leadSheet = page.getByRole("dialog", { name: "Mitlesen" });
      await expect(leadSheet.getByText("Abgehängt")).toBeVisible();
      await expect(leadSheet.getByText(/Absätze zurück/)).toBeVisible();
      await page.keyboard.press("Escape");
    } finally {
      await ownerContext.close();
    }

    await page.goto(`${SKRIPT}&fassung=${versionId}`);
    await discard(page);
    expect(errors).toEqual([]);
  });
});
