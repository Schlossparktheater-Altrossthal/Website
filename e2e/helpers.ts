import { expect, type Locator } from "@playwright/test";

/**
 * Klickt ein Element, dessen Wirkung erst nach der Hydration einsetzt, und
 * wiederholt den Klick, bis `settled` erfüllt ist.
 *
 * Hintergrund: `next dev` liefert das HTML aus, bevor React hydratisiert hat.
 * Die Seite sieht dann fertig aus, reagiert aber noch nicht – ein Klick verpufft
 * wirkungslos. Auf schnellen Rechnern ist das Fenster kaum messbar, im CI
 * reproduzierbar (dort lief der Klick auf „Neue Probe anlegen“ ins Leere).
 * Die Bereiche einer Seite werden zudem unabhängig voneinander hydratisiert,
 * ein sichtbarer Kalender sagt also nichts über den Seitenkopf.
 *
 * Doppelte Klicks sind ausgeschlossen, solange das Element während der laufenden
 * Aktion umbenannt wird: `AsyncButton` zeigt dann den Ladetext und `disabled`,
 * `target` findet es in diesem Zustand nicht mehr.
 */
export async function clickUntil(
  target: Locator,
  settled: () => Promise<unknown>,
  { attemptTimeout = 2_000, timeout = 60_000 }: { attemptTimeout?: number; timeout?: number } = {},
) {
  await expect(async () => {
    if (await target.count()) {
      // Fehlschläge hier sind erwartbar (Klick vor der Hydration, überlagerte
      // Ziele) – `settled` entscheidet, ob es geklappt hat.
      await target.click({ timeout: attemptTimeout }).catch(() => {});
    }
    await settled();
  }).toPass({ timeout });
}
