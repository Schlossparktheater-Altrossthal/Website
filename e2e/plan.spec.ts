import { expect, test, type Page } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// Produktionsplan (docs/Plan/projektplanung-plan.md, docs/seiten/produktionen.md):
// Meilenstein anlegen, Karte im Gewerk-Board daran hängen, abhaken und wieder aufräumen.
// Alle Daten tragen das Präfix „E2E“ und werden am Ende gelöscht.

const stamp = Date.now().toString(36);
const BERLIN_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" });
// Frist mit festem Datum in der Zukunft: unabhängig von Premiere und Tageszeit.
const inDays = (days: number) => BERLIN_DAY.format(new Date(Date.now() + days * 86_400_000));

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openPlanAgenda(page: Page) {
  await page.goto("/mitglieder/produktionen");
  const missing = await page
    .getByText("Keine aktive Produktion ausgewählt.")
    .isVisible()
    .catch(() => false);
  test.skip(missing, "Testnutzer hat keine aktive Produktion");
  const agenda = page.getByRole("radio", { name: "Agenda" });
  if (await agenda.count()) {
    await clickUntil(agenda, () => expect(agenda).toBeChecked());
  }
}

async function openMilestone(page: Page, title: string) {
  const row = page.getByRole("button", { name: new RegExp(title) }).first();
  await clickUntil(row, () => expect(page.getByText("Bezug", { exact: true })).toBeVisible());
}

test.describe("als admin", () => {
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "serial" });

  test("Meilenstein anlegen, Karte verknüpfen, abhaken und aufräumen", async ({ page }) => {
    const errors = await collectErrors(page);
    const title = `E2E Meilenstein ${stamp}`;
    const card = `E2E Karte ${stamp}`;

    await page.goto("/mitglieder/produktionen");
    const missing = await page
      .getByText("Keine aktive Produktion ausgewählt.")
      .isVisible()
      .catch(() => false);
    test.skip(missing, "Testnutzer hat keine aktive Produktion");

    // Anlegen – im leeren Plan heißt der Button anders.
    const create = page.getByRole("button", {
      name: /^(\+ Meilenstein|Ersten Meilenstein anlegen)$/,
    });
    const dialog = page.getByRole("dialog");
    await clickUntil(create.first(), () => expect(dialog).toBeVisible());
    await dialog.getByLabel("Titel").fill(title);
    await dialog.getByRole("combobox", { name: "Gewerk" }).click();
    const departments = page.getByRole("option");
    test.skip((await departments.count()) < 2, "Produktion hat keine Gewerke");
    await departments.nth(1).click();
    await dialog.getByRole("combobox", { name: "Bezug" }).click();
    await page.getByRole("option", { name: "festes Datum" }).click();
    await dialog.getByLabel("Datum").fill(inDays(10));
    await expect(dialog.getByText("Fällig am")).toBeVisible();
    await dialog.getByRole("button", { name: "Anlegen", exact: true }).click();
    await expect(page.getByText("Meilenstein angelegt.")).toBeVisible();

    // In der Agenda öffnen: noch keine Karten, Sprung ins Board mit „+ Karte“.
    await openPlanAgenda(page);
    await openMilestone(page, title);
    await expect(page.getByText("Noch keine Karten")).toBeVisible();
    await page.getByRole("link", { name: "+ Karte" }).click();
    await expect(page).toHaveURL(/ansicht=aufgaben.*meilenstein=/);
    const taskDialog = page.getByRole("dialog");
    // Der Meilenstein steckt im eingeklappten Bereich „Details“.
    await taskDialog.getByRole("button", { name: /^Details/ }).click();
    await expect(taskDialog.getByLabel("Gehört zu Meilenstein")).toHaveValue(/.+/);
    await taskDialog.getByLabel("Was ist zu tun?").fill(card);
    await taskDialog.getByRole("button", { name: "Anlegen", exact: true }).click();
    await expect(page.getByText(card).first()).toBeVisible();
    // Chip des Meilensteins auf der Karte.
    // (nicht die gleichnamige Option im Meilenstein-Filter)
    await expect(
      page.getByRole("button", { name: new RegExp(card) }).getByText(title),
    ).toBeVisible();

    // Zurück im Plan: Karte hängt am Meilenstein, Abhaken fragt wegen offener Karte nach.
    await openPlanAgenda(page);
    await openMilestone(page, title);
    await expect(page.getByText("0 von 1 erledigt")).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(card) })).toBeVisible();
    await page.getByRole("button", { name: "Als erledigt markieren" }).first().click();
    await expect(page.getByText("Trotzdem erledigt?")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Als erledigt markieren" }).click();
    await expect(page.getByText("Als erledigt markiert.")).toBeVisible();

    // Aufräumen: Karte aus dem Panel heraus öffnen und löschen, dann den Meilenstein.
    await page.getByRole("link", { name: new RegExp(card) }).click();
    await expect(page).toHaveURL(/karte=/);
    // Löschen sitzt im Fuß, der erst mit „Details“ erscheint.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Details/ })
      .click();
    await page.getByRole("button", { name: "Aufgabe löschen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(page.getByText(card)).toHaveCount(0);

    await openPlanAgenda(page);
    await page.getByRole("button", { name: /erledigt anzeigen/ }).click();
    await openMilestone(page, title);
    await page.getByRole("button", { name: "Löschen", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(page.getByText("Meilenstein gelöscht.")).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("Tabs der Produktionsseite und Verwaltung im Sheet", async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto("/mitglieder/produktionen?verwalten=1");
    await expect(page.getByRole("heading", { name: "Produktionen verwalten" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/verwalten=1/);

    const missing = await page
      .getByText("Keine aktive Produktion ausgewählt.")
      .isVisible()
      .catch(() => false);
    test.skip(missing, "Keine aktive Produktion");
    const nav = page.getByRole("navigation", { name: "Produktionsbereiche" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Gewerke" }).click();
    await expect(page).toHaveURL(/\/mitglieder\/produktionen\/gewerke$/);
    await page
      .getByRole("navigation", { name: "Produktionsbereiche" })
      .getByRole("link", { name: "Stück" })
      .click();
    await expect(page).toHaveURL(/\/mitglieder\/produktionen\/stueck/);

    expect(errors).toEqual([]);
  });
});
