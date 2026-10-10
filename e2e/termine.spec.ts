import { expect, test, type Locator, type Page } from "@playwright/test";

import { authFile } from "./env";
import { clickUntil } from "./helpers";

// „Meine Termine" (docs/seiten/meine-termine.md): Ansicht und Filter stehen in der URL, eine Absage
// landet in der Sperrliste – innerhalb der Sperrfrist als Notfall mit Pflichtgrund. Die Tests legen
// ihren „Termin für alle" selbst an, räumen die Sperrliste vorher auf und entfernen beides wieder.

const BERLIN_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const LONG_DAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Berlin",
});
const SHORT_DAY = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});

const STATUS_LABELS = ["Bevorzugt", "Eingeschränkt", "Gesperrt", "Notfall"];

/** Tagesschlüssel (yyyy-MM-dd) relativ zu heute, gerechnet in Berliner Zeit. */
function berlinDay(offset = 0) {
  const anchor = new Date(`${BERLIN_DAY.format(new Date())}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + offset);
  return anchor.toISOString().slice(0, 10);
}

/** Mittag des Tages, damit Zeitzonen die Formatierung nicht kippen. */
const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

/** `next dev` bricht eine Navigation gelegentlich ab (net::ERR_ABORTED, ohne Anfrage am Server). */
async function goto(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch (error) {
    if (!String(error).includes("ERR_ABORTED")) throw error;
    await page.goto(url);
  }
}

function rowOf(page: Page, title: string): Locator {
  return page.getByRole("listitem").filter({ hasText: title });
}

/**
 * Legt über die Terminplanung einen „Termin für alle" an: ohne Einladung und produktionsunabhängig.
 * Nur so erscheint er in „Meine Termine" bei allen – und damit auch beim Testnutzer.
 */
async function createOpenEvent(page: Page, title: string, day: string) {
  await goto(page, "/mitglieder/terminplanung");
  await expect(page).not.toHaveURL(/\/login/);
  test.skip(
    await page
      .getByText(/Kein Zugriff auf die Terminplanung/)
      .isVisible()
      .catch(() => false),
    "Der Testnutzer darf in dieser Umgebung nicht planen",
  );

  // „Neu" legt einen Entwurf für den gewählten Tag (heute) an und öffnet den Editor.
  await clickUntil(page.getByRole("button", { name: "Neu", exact: true }), () =>
    expect(page.getByRole("menuitem", { name: "Anderer Termin" })).toBeVisible({ timeout: 2_000 }),
  );
  await page.getByRole("menuitem", { name: "Anderer Termin" }).click();
  await expect(page).toHaveURL(/\/mitglieder\/terminplanung\/[^/]+$/);
  const eventId = page.url().split("/").pop() ?? "";

  await page.getByLabel("Titel").fill(title);
  // Datum steckt hinter der Angabe „Wann“ (Blatt mit Datum und Uhrzeit).
  await clickUntil(page.getByRole("button", { name: /^Wann:/ }), () =>
    expect(page.locator("#event-date")).toBeVisible({ timeout: 2_000 }),
  );
  await page.locator("#event-date").fill(day);
  await page.getByRole("dialog").getByRole("button", { name: "Fertig" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // „Gehört zu: Keiner Produktion" (sonst gilt der Termin nur der aktiven Produktion) und
  // „Wer ist eingeladen? Alle" – beides ist nötig, damit ihn alle sehen.
  const scope = page.getByRole("button", { name: /^Gehört zu:/ });
  if (await scope.count()) {
    await clickUntil(scope, () =>
      expect(page.getByRole("menuitem", { name: "Keiner Produktion" })).toBeVisible({
        timeout: 2_000,
      }),
    );
    await page.getByRole("menuitem", { name: "Keiner Produktion" }).click();
    await expect(scope).toHaveAccessibleName(/keiner Produktion/);
  }
  const audience = page.getByRole("radiogroup", { name: "Wer ist eingeladen?" });
  const everyone = audience.getByRole("radio", { name: "Alle", exact: true });
  await clickUntil(everyone, () => expect(everyone).toHaveAttribute("aria-checked", "true"));

  await clickUntil(page.getByRole("button", { name: "Ansetzen", exact: true }), () =>
    expect(page).toHaveURL(/\/mitglieder\/termine\//),
  );
  return eventId;
}

async function deleteEvent(page: Page, eventId: string) {
  await goto(page, `/mitglieder/terminplanung/${eventId}`);
  const actions = page.getByRole("region", { name: "Aktionen" });
  await clickUntil(actions.getByRole("button", { name: "Löschen" }), () =>
    expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
  );
  await page.getByRole("dialog").getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(page).toHaveURL(/\/mitglieder\/terminplanung$/);
}

/** Der Tag im Monatsraster der Sperrliste – ggf. einen Monat weiterblättern. */
async function blocklistDay(page: Page, day: string) {
  const cell = page.getByRole("gridcell", { name: LONG_DAY.format(atNoon(day)) }).first();
  for (let attempt = 0; attempt < 3 && !(await cell.count()); attempt += 1) {
    await page.getByRole("button", { name: "Nächster Monat" }).click();
  }
  await expect(cell).toBeVisible();
  return cell;
}

/**
 * Räumt einen eigenen Eintrag am Zieltag weg. Nötig, weil ein liegen gebliebener Eintrag aus einem
 * früheren Lauf nicht mehr zu seinem Termin gehört (die Verknüpfung fällt mit dem Termin weg) und
 * ein neuer Lauf ihn deshalb nicht über „Doch dabei" loswird.
 */
async function clearOwnEntry(page: Page, day: string) {
  await goto(page, "/mitglieder/sperrliste");
  const dateLabel = LONG_DAY.format(atNoon(day));
  const cell = await blocklistDay(page, day);
  // Der Zustand steht direkt hinter dem Datum, danach folgen die Termine des Tages.
  const status = ((await cell.getAttribute("aria-label")) ?? "")
    .slice(dateLabel.length + 2)
    .split(", ")[0];
  if (!STATUS_LABELS.includes(status)) return;

  await cell.click();
  const remove = page.getByRole("button", { name: "Eintrag entfernen" });
  if (await remove.count()) {
    await remove.click();
  } else {
    // Normale Sperre: „Frei" nimmt den Eintrag weg; nicht setzbar ist nur der Notfall.
    await page
      .getByRole("radiogroup", { name: "Verfügbarkeit" })
      .getByRole("radio", { name: /^Frei/ })
      .click();
  }
  await expect
    .poll(async () => (await cell.getAttribute("aria-label")) ?? "", { timeout: 10_000 })
    .not.toContain(`, ${status},`);
}

/**
 * Absage über die Oberfläche und Prüfung in der Sperrliste. `status` ist die Beschriftung, die der
 * Tag dort tragen muss: „Notfall" innerhalb der Sperrfrist, „Gesperrt" außerhalb.
 */
async function declineAndCheck(
  page: Page,
  {
    title,
    day,
    status,
    eventId,
  }: { title: string; day: string; status: "Notfall" | "Gesperrt"; eventId: string },
) {
  const emergency = status === "Notfall";
  const marked = new RegExp(`^${LONG_DAY.format(atNoon(day))}, ${status}`);
  // Die Liste zeigt den Termin als Zeile; abgesagt wird auf der Terminseite.
  await expect(rowOf(page, title)).toBeVisible();
  await goto(page, `/mitglieder/termine/${eventId}`);
  await expect(page.getByText(SHORT_DAY.format(atNoon(day))).first()).toBeVisible();

  const open = page.getByRole("button", { name: "Absagen" });
  await clickUntil(open, () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 }));

  const dialog = page.getByRole("dialog");
  const send = dialog.getByRole("button", {
    name: emergency ? "Notfall-Absage senden" : "Absage senden",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", { name: emergency ? "Notfall-Absage" : "Absagen", exact: true }),
  ).toBeVisible();
  // Innerhalb der Sperrfrist ist der Grund Pflicht – der Knopf bleibt bis dahin gesperrt.
  if (emergency) await expect(send).toBeDisabled();

  await dialog.locator("textarea").fill("E2E: kurzfristig verhindert");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText(emergency ? "abgesagt (Notfall)" : "abgesagt", { exact: true }),
  ).toBeVisible();
  await goto(page, "/mitglieder/meine-proben");
  await expect(rowOf(page, title).first()).toContainText(emergency ? "Notfall" : "abgesagt");

  await goto(page, "/mitglieder/sperrliste");
  await expect(await blocklistDay(page, day)).toHaveAttribute("aria-label", marked);

  // „Doch dabei" räumt den Eintrag wieder weg – Löschen ist von der Sperrfrist nicht betroffen.
  await goto(page, `/mitglieder/termine/${eventId}`);
  await clickUntil(page.getByRole("button", { name: "Doch dabei" }), () =>
    expect(page.getByRole("button", { name: "Absagen" })).toBeVisible({ timeout: 2_000 }),
  );
  await goto(page, "/mitglieder/sperrliste");
  await expect(await blocklistDay(page, day)).not.toHaveAttribute("aria-label", marked);
}

/**
 * Aufräumen, auch wenn ein Schritt fehlschlägt. Wichtig: Ein liegen gebliebener Termin samt Eintrag
 * am selben Tag würde den nächsten Lauf blockieren – „Doch dabei" nimmt einen Eintrag nicht mehr
 * weg, wenn an dem Tag noch ein anderer abgesagter Termin steht.
 */
async function cleanup(page: Page, title: string, eventId: string) {
  try {
    await goto(page, `/mitglieder/termine/${eventId}`);
    const back = page.getByRole("button", { name: "Doch dabei" });
    if (await back.count()) {
      await clickUntil(back, () => expect(back).toHaveCount(0, { timeout: 2_000 }));
    }
    await deleteEvent(page, eventId);
  } catch (error) {
    // Nur der Testlauf ist schon kaputt – hier nichts überdecken, aber auch nicht abbrechen.
    console.warn(`[e2e] Aufräumen nach „${title}" fehlgeschlagen:`, error);
  }
}

test.describe("Meine Termine", () => {
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "serial" });

  test("Ansicht, Suche und Vergangenheit stehen in der URL", async ({ page }) => {
    await goto(page, "/mitglieder/meine-proben");
    await expect(page.getByRole("navigation", { name: "Ansicht" })).toBeVisible();
    await expect(page.getByLabel("Termin suchen")).toBeVisible();

    // Kalender als Umschalter: der Zustand steht in der URL, Deep-Links und Zurück funktionieren.
    await page.getByRole("link", { name: "Kalender", exact: true }).click();
    await expect(page).toHaveURL(/ansicht=kalender/);
    await expect(page.getByRole("grid").first()).toBeVisible();
    await expect(page.getByLabel("Termin suchen")).toHaveCount(0);

    await page.getByRole("link", { name: "Liste", exact: true }).click();
    await expect(page).not.toHaveURL(/ansicht=/);
    await expect(page.getByLabel("Termin suchen")).toBeVisible();

    // Suche als GET-Formular: der Begriff steht in der URL und wird serverseitig gefiltert.
    await page.getByLabel("Termin suchen").click();
    await page.getByLabel("Titel oder Ort").fill("zzz-kein-treffer");
    await page.getByRole("button", { name: "Suchen" }).click();
    await expect(page).toHaveURL(/q=zzz-kein-treffer/);
    await expect(
      page.getByText(
        /(In dieser Auswahl stehen gerade keine Termine an|Sobald du zu Terminen eingeladen wirst)/,
      ),
    ).toBeVisible();

    // Die Suche lädt die Seite neu – der erste Klick danach kann vor der Hydrierung verpuffen.
    await clickUntil(page.getByRole("link", { name: "Vergangene Termine zeigen" }), () =>
      expect(page).toHaveURL(/vergangen=1/, { timeout: 2_000 }),
    );
    await expect(page.getByRole("heading", { name: "Vergangene Termine" })).toBeVisible();

    // Deep-Link mit mehreren Parametern lädt dieselbe Ansicht wieder.
    await goto(page, "/mitglieder/meine-proben?ansicht=kalender&gruppe=club&vergangen=1");
    await expect(page.getByRole("navigation", { name: "Ansicht" })).toBeVisible();
    await expect(page.getByRole("grid").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Kalender", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Absage innerhalb der Sperrfrist wird zum Notfall-Tag", async ({ page }) => {
    // Morgen liegt immer innerhalb der Sperrfrist (Standard: 7 Tage) und ist nie Vergangenheit.
    const day = berlinDay(1);
    const title = `E2E Absage kurzfristig ${Date.now().toString(36)}`;
    await clearOwnEntry(page, day);
    const eventId = await createOpenEvent(page, title, day);

    try {
      await goto(page, "/mitglieder/meine-proben");
      await declineAndCheck(page, { title, day, status: "Notfall", eventId });
    } finally {
      await cleanup(page, title, eventId);
    }
  });

  test("Absage außerhalb der Sperrfrist sperrt den Tag", async ({ page }) => {
    // Deutlich jenseits der Sperrfrist: normale Sperre, der Grund bleibt freiwillig.
    const day = berlinDay(20);
    const title = `E2E Absage langfristig ${Date.now().toString(36)}`;
    await clearOwnEntry(page, day);
    const eventId = await createOpenEvent(page, title, day);

    try {
      await goto(page, "/mitglieder/meine-proben");
      await declineAndCheck(page, { title, day, status: "Gesperrt", eventId });
    } finally {
      await cleanup(page, title, eventId);
    }
  });

  test("Planung sagt einen Termin ab und nimmt die Absage zurück", async ({ page }) => {
    const day = berlinDay(10);
    const title = `E2E Ausfall ${Date.now().toString(36)}`;
    const reason = "E2E: Bühne nicht verfügbar";
    const eventId = await createOpenEvent(page, title, day);

    try {
      await goto(page, `/mitglieder/terminplanung/${eventId}`);
      const actions = page.getByRole("region", { name: "Aktionen" });
      await clickUntil(actions.getByRole("button", { name: "Absagen" }), () =>
        expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
      );
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Grund (optional)").fill(reason);
      await dialog.getByRole("button", { name: "Termin absagen" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(`Grund: ${reason}`)).toBeVisible();
      await expect(actions.getByRole("button", { name: "Absage zurücknehmen" })).toBeVisible();

      // Mitglieder sehen den Termin weiter – als Ausfall mit Grund, ohne eigene Absage.
      await goto(page, `/mitglieder/termine/${eventId}`);
      await expect(page.getByText("Dieser Termin fällt aus.").first()).toBeVisible();
      await expect(page.getByText(`Grund: ${reason}`).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Absagen" })).toHaveCount(0);
      await goto(page, "/mitglieder/meine-proben");
      await expect(rowOf(page, title).first()).toContainText("fällt aus");

      // Rücknahme: der Termin gilt wieder wie vorher.
      await goto(page, `/mitglieder/terminplanung/${eventId}`);
      await clickUntil(actions.getByRole("button", { name: "Absage zurücknehmen" }), () =>
        expect(actions.getByRole("button", { name: "Absagen" })).toBeVisible({ timeout: 2_000 }),
      );
      await goto(page, `/mitglieder/termine/${eventId}`);
      await expect(page.getByText("Dieser Termin fällt aus.")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Absagen" }).first()).toBeVisible();
    } finally {
      await cleanup(page, title, eventId);
    }
  });
});
