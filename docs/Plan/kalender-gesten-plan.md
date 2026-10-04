# Plan: Kalender – Gesten, Mehrfachauswahl und Tastatur

Stand: 2026-10-04. Entschieden (E1–E5), nichts umgesetzt. Checkliste am Ende wird gepflegt.

## Ziel

1. Kalender mobil mit dem Daumen bedienbar: Monat per Wischen wechseln, Mehrfachauswahl per Halten + Ziehen.
2. Am Rechner Mehrfachauswahl wie im Dateimanager: Strg/Cmd-Klick, Shift-Klick, Ziehen mit der Maus.
3. Vollständige Tastaturbedienung nach WAI-ARIA-Grid-Muster.
4. Alles einmal in `MonthGrid` bauen – alle vier Kalender profitieren, Seiten schalten nur Funktionen frei.

## Ist-Stand (Befunde)

Screenshots Staging 2026-10-04 (mobil + Desktop, Sperrliste/Terminplanung/Meine Termine) angesehen.

| #   | Befund                                                                                                                                                               | Stelle                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| B1  | Die eigentliche Komponente ist `MonthGrid` (257 Z.). `MonthCalendar` (472 Z.) wird nirgends importiert – toter Code.                                                 | `src/components/calendar/month-calendar.tsx`                                                            |
| B2  | `MonthGrid` wird an 4 Stellen genutzt: Sperrliste, Terminplanung, Meine Termine, Produktionsplan.                                                                    | `my-calendar.tsx`, `terminplanung/page-client.tsx`, `my-events-calendar.tsx`, `_plan/plan-calendar.tsx` |
| B3  | Monatswechsel nur über die kleinen Pfeile oben rechts; kein Wischen.                                                                                                 | `month-switcher.tsx`                                                                                    |
| B4  | Mehrfachauswahl nur über versteckten Weg: Tag antippen → Blatt öffnet → „Mehrere Tage auswählen“ → Blatt schließt → Tage einzeln antippen. Kein Ziehen, kein Halten. | `my-calendar.tsx` (`onStartMulti`, `selectDay`)                                                         |
| B5  | Am Desktop keine Tastenkürzel (Shift/Strg), kein Ziehen über Zeiträume; Zeiträume nur über den „Zeitraum“-Dialog mit Datumsfeldern.                                  | `range-dialog.tsx`                                                                                      |
| B6  | `role="grid"` gesetzt, aber jede Zelle ist ein eigener Tab-Stopp (bis 42×Tab), keine Pfeiltasten. Widerspricht dem Grid-Muster.                                      | `month-grid.tsx` `DayCell`                                                                              |
| B7  | Monatsrand: in der Mehrfachauswahl bleibt die Auswahl beim Monatswechsel erhalten, ist aber nicht sichtbar (Zähler ja, Tage nein).                                   | `MultiSelectBar`                                                                                        |
| B8  | Mobil verschwindet das Legendenende („Feiertag“) unter der unteren Navigationsleiste.                                                                                | Sperrliste mobil                                                                                        |
| B9  | Kein haptisches Feedback; `navigator.vibrate` gibt es bisher nur im Scanner.                                                                                         | `qr-scanner.tsx`                                                                                        |
| B10 | Kein Rückgängig nach Sammel-Eintrag mehrerer Tage.                                                                                                                   | `onAddRange`                                                                                            |

## Zielbild

### Interaktion (mobil zuerst)

| Geste                                | Wirkung                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Tippen                               | wie heute: Tag wählen, mobil Blatt öffnen                                                                   |
| Wischen links/rechts über dem Raster | nächster/vorheriger Monat, Raster folgt dem Finger (Achsensperre: nur wenn                                  | dx  | >   | dy  | und > 40 px, sonst normales Scrollen; `touch-action: pan-y`) |
| Halten (~450 ms) auf einem Tag       | Mehrfachauswahl startet mit diesem Tag, kurze Vibration                                                     |
| Halten und weiterziehen              | „Malen“: alle überstrichenen Tage werden (je nach Starttag) an- oder abgewählt; fortlaufender Zeitraum (E2) |
| Ziehen an den Rasterrand             | nach kurzer Verweildauer Monatswechsel, Auswahl läuft weiter                                                |
| Tippen in Mehrfachauswahl            | Tag an/aus wie heute                                                                                        |

Desktop:

| Eingabe              | Wirkung                                                       |
| -------------------- | ------------------------------------------------------------- |
| Klick                | Tag wählen (Detail-Panel)                                     |
| Strg/Cmd + Klick     | Tag zur Auswahl hinzufügen/entfernen, startet Mehrfachauswahl |
| Shift + Klick        | Zeitraum vom Anker bis hier                                   |
| Maus gedrückt ziehen | Zeitraum malen                                                |
| Pfeiltasten          | Fokus tageweise/wochenweise (roving tabindex, ein Tab-Stopp)  |
| Shift + Pfeile       | Auswahl erweitern                                             |
| Leertaste / Enter    | Tag umschalten bzw. öffnen                                    |
| Bild↑/↓              | Monat zurück/vor; Pos1/Ende Wochenanfang/-ende; `T` heute     |
| Esc                  | Mehrfachauswahl verlassen                                     |

Kleiner Hinweis „Tipp: Halten zum Mehrfachauswählen“ bzw. „Shift/Strg für mehrere Tage“ einmalig statt des heutigen Hilfetextes.

### Technik

- `MonthGrid` bekommt `selection?: { mode: "single" | "multi"; keys; onChange; isSelectable? }` statt nur `selectedKeys/onSelect`; Logik in einem Hook `useDaySelection` (Anker, Malen, Tastatur) – testbar ohne DOM.
- Gesten mit Pointer Events (ein Code für Maus/Touch/Stift), `setPointerCapture`, Zelle per `data-date` + `elementFromPoint`; keine neue Bibliothek nötig (Wischen gibt es schon im Dialog, `dialog.tsx`).
- Zustand der Mehrfachauswahl wandert aus `my-calendar.tsx` in die Komponente/Hook; Seiten liefern nur `isSelectable` (z. B. Vergangenheit/Sperrfrist) und Aktionen.
- `prefers-reduced-motion`: Wischen ohne Mitzieh-Animation, nur Wechsel.
- Haptik über kleine Hilfsfunktion `haptic()` (iOS Safari ignoriert `vibrate` still).

### Oberflächen

- **Sperrliste**: volle Nutzung; `MultiSelectBar` zeigt zusätzlich Schnellauswahl („alle Wochenenden“, „alle Kerntage“ im Monat) und nach dem Speichern einen Toast mit „Rückgängig“. Der „Zeitraum“-Dialog bleibt für lange Zeiträume über Monate.
- **Terminplanung, Meine Termine, Produktionsplan**: nur Wischen + Tastatur, Auswahl einzeln; Halten ohne Wirkung (E1, E4).

## Phasen

1. **Aufräumen + Tastatur**: `MonthCalendar` löschen (B1), roving tabindex + Pfeiltasten/Bild/Pos1/Ende/T in `MonthGrid` (B6), Legende mobil nicht mehr unter der Leiste (B8). Unit-Tests für die Fokuslogik.
2. **Wischen für Monatswechsel** in `MonthGrid` (optional `onMonthSwipe`), Mitzieh-Animation, an allen 4 Stellen einschalten (B3).
3. **Auswahlmodell** `useDaySelection` + neue `selection`-Prop; Sperrliste darauf umstellen, Verhalten unverändert. Unit-Tests (Anker, Bereiche, gesperrte Tage).
4. **Desktop-Mehrfachauswahl**: Strg/Cmd-Klick, Shift-Klick, Shift+Pfeile, Maus-Ziehen, Esc (B5).
5. **Mobil Halten + Malen**, Haptik, Randwechsel des Monats, Auswahl über Monate sichtbar (B4, B7, B9).
6. **Sperrliste-Feinschliff**: Schnellauswahl, Rückgängig-Toast (B10), neuer Hinweistext.
7. ~~Terminplanung anbinden~~ – entfällt (E1).
8. **E2E + Prüfung**: Playwright mit Touch-Emulation (Halten/Ziehen/Wischen) und Tastatur, Screenshots mobil+Desktop auf Staging, Test auf echtem Android/iPhone (Halten kollidiert dort gern mit Textauswahl/Kontextmenü → `user-select: none`, `-webkit-touch-callout: none`).

## Entscheidungen (2026-10-04)

- E1: Terminplanung bekommt keine Mehrfachauswahl, nur Wischen + Tastatur. Phase 7 entfällt.
- E2: Ziehen markiert einen durchgehenden Zeitraum (wie Text markieren).
- E3: Ziehen an den Rasterrand wechselt nach kurzer Verweildauer den Monat, Auswahl läuft weiter.
- E4: Auf Seiten ohne Mehrfachauswahl macht Halten nichts.
- E5: Kein Strg+A.

## Checkliste

- [ ] Phase 1 Aufräumen + Tastatur
- [ ] Phase 2 Wischen
- [ ] Phase 3 Auswahlmodell
- [ ] Phase 4 Desktop-Mehrfachauswahl
- [ ] Phase 5 Mobil Halten + Malen
- [ ] Phase 6 Sperrliste-Feinschliff
- [x] Phase 7 entfällt (E1)
- [ ] Phase 8 E2E, Screenshots, Gerätetest
