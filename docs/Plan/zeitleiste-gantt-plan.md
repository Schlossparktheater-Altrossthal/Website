# Plan: Zeitleiste des Produktionsplans als Gantt-Ansicht

Stand: 2026-10-30. Konzept, Entscheidungen offen (siehe unten). Nachfolger der Zeitleiste aus
`docs/Plan/projektplanung-plan.md`.

## Ziel

Die Zeitleiste im Reiter „Plan“ (`/mitglieder/produktionen`) wird zu einer übersichtlichen
Gantt-Ansicht nach dem Vorbild von Miro-, Asana- oder TeamGantt-Timelines: Aufgaben als Balken mit
Dauer, eine Zeile pro Aufgabe, gruppiert nach Gewerk, Bearbeiten direkt im Diagramm.

## Ist-Stand (Befunde, Screenshot Staging 2026-10-30, Desktop 1440 px)

| #   | Befund                                                                                                                                                    | Stelle                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Eine Zeile pro **Gewerk**, alle Meilensteine als Punkte in dieselbe Zeile. Liegen sie nah beieinander, überlappen Beschriftungen oder werden ausgeblendet | `timeline.tsx` labelPlacement |
| 2   | Beschriftungen laufen rechts aus dem Bild („GEMA/Rechte“, „Bei der Stadt Veranstaltung beantrag…“), Label „Social Medi…“ abgeschnitten (Spalte 132 px)    | `timeline.tsx` LABEL_WIDTH    |
| 3   | Nur Punkte, keine Dauer. Was „bis Mai fertig“ heißt, wann es losgeht und wie lange es dauert, sieht man nicht                                             | `ShowMilestone` (nur dueAt)   |
| 4   | Abhängigkeitspfeile als Kurven quer über Zeilen, rote Kurven kreuzen Beschriftungen                                                                       | `timeline.tsx` Abhängigkeiten |
| 5   | Keine Aufgabenliste links (Titel, Gewerk, Datum, Status); Details nur per Antippen                                                                        | –                             |
| 6   | Zoom nur Monat/Woche mit festen Pixeln, kein „Alles einpassen“, kein Quartal; Monatsköpfe ohne Jahr, Premiere-Beschriftung abgeschnitten („★ Pr“)         | `PX_PER_DAY`                  |
| 7   | Neuer Meilenstein nur über Button + Formular, nicht durch Ziehen im Diagramm; Ziehen verschiebt nur, ohne Dauer zu ändern                                 | `plan-view.tsx`               |
| 8   | Zeile „Proben“ zeigt Einzelstriche ohne Aussage; Endprobenwoche geht darin unter                                                                          | `timeline.tsx` Proben         |

## Zielbild

```
┌──────────────────────────────────────┬──────────── 2026 ─────┬───────── 2027 ─────────────────┐
│ Aufgabe            Gewerk  Ende  ●   │ Nov  Dez  Jan  Feb  … │ Apr  Mai  Jun                   │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ ▾ Technik (2)                        │      ░░░░░░░░░░░░░░░░░░░░░░░░░░ (Sammelbalken)         │
│   Technikliste Förderung   Dez 05 ●  │      ████▌                                              │
│   Mietabsprache Technik    Apr 02 ●  │                       ███████████▌                      │
│ ▾ Social Media (1)                   │                                                         │
│   Plakat/Druck             Mai 03 ●  │                              ████▌──┐                   │
│ ▾ Produktion (3)                     │                                     └► ◆ Ticketstart    │
│   GEMA/Rechte              Jun 10 ●  │                                           ████▌         │
│ + Aufgabe hinzufügen                 │                                                         │
├──────────────────────────────────────┼─ heute ┊ ──────────── Endprobenwoche ▓▓ ─── ★ Premiere ┤
└──────────────────────────────────────┴────────────────────────────────────────────────────────┘
 [Woche | Monat | Quartal | Alles]  [Heute]  Filter: Gewerk ▾  nur offene  nur kritischer Pfad
```

### Grundregeln

1. **Eine Zeile pro Aufgabe**, Gruppen je Gewerk mit Sammelbalken, ein-/ausklappbar. Damit
   überlappt nichts mehr; Befund 1, 2 und 4 entfallen.
2. **Linke Aufgabenliste** (Titel, Gewerk-Farbe, Enddatum, Ampel) fest, Diagramm rechts scrollt
   horizontal; Breite der Liste ziehbar, Titel vollständig (zweizeilig statt abgeschnitten).
3. **Balken = Zeitraum** (Start bis Frist), **Raute = Termin ohne Dauer** (Abnahme, Premiere,
   Ticketstart). Beschriftung im Balken, wenn Platz ist, sonst rechts daneben – nie abgeschnitten.
4. **Fortschritt im Balken**: Füllung nach erledigten Karten (`tasksDone/tasksTotal`), Ampelfarbe
   wie bisher (grün/gelb/rot/grau).
5. **Abhängigkeiten als rechtwinklige Linien** (Ende → Start), standardmäßig dezent, beim Auswählen
   einer Aufgabe hervorgehoben; kritischer Pfad per Schalter rot.
6. **Direkt bearbeiten**: Balken ziehen = verschieben, Kante ziehen = Dauer ändern, auf leere Zeile
   ziehen = neue Aufgabe, Punkt am Balkenende zu anderem Balken ziehen = Abhängigkeit. Vorschau der
   Folgeverschiebungen wie heute, Bestätigung über den vorhandenen Dialog.
7. **Zeitachse zweistufig** (Jahr/Monat bzw. Monat/KW), Zoom Woche/Monat/Quartal/„Alles einpassen“,
   Knopf „Heute“, Strg+Mausrad zoomt. Wochenenden und Ferien dezent schraffiert (Ferien gibt es schon
   im Ablaufplan-PDF).
8. **Proben** als schmales Band unter der Zeitachse (Dichte je Woche) statt eigener Zeile;
   Endprobenwoche und Premiere als vertikale Markierungen über die ganze Höhe.
9. **Details** wie bisher als Panel rechts / `BottomSheet`; Tablet hochkant: Liste einklappbar auf
   reine Titel. Handy bleibt bei Agenda.

## Technik

- Weiter eigene SVG-Umsetzung (wie heute), aufgeteilt in `gantt/` (Achse, Liste, Zeile, Balken,
  Pfeile, Interaktion). Bibliotheken (frappe-gantt, dhtmlx, SVAR Gantt) geprüft auf Theme-Tokens und
  Lizenz – Entscheidung offen (E3).
- Virtualisierung erst bei > 100 Zeilen nötig; bei ~10–40 Aufgaben nicht.
- Datenmodell: `ShowMilestone.startAt` (berechnet) bzw. `durationDays Int @default(0)`;
  `0` = Raute. Startdatum folgt aus Frist − Dauer, damit die Rückwärtsplanung ab Premiere erhalten
  bleibt. Vorlagen (`templates-panel.tsx`) übernehmen die Dauer.
- Tastatur: Pfeiltasten verschieben ausgewählten Balken um einen Tag, Umschalt+Pfeil ändert Dauer.

## Offene Entscheidungen

| #   | Frage                                                                                            | Vorschlag                      |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| E1  | Dauern einführen? `projektplanung-plan.md` schloss „Dauern pro Aufgabe“ bewusst aus              | Ja, optional (Standard 0)      |
| E2  | Gewerke-Karten (`DepartmentTask`) mit Fälligkeit als Unterzeilen unter ihrem Meilenstein zeigen? | Ja, eingeklappt                |
| E3  | Eigene SVG-Umsetzung oder Bibliothek?                                                            | Eigene (Tokens, Touch, Lizenz) |
| E4  | Zeile „Proben“ behalten oder als Band unter der Achse?                                           | Band                           |

## Phasen

1. **Layout**: Aufgabenliste links + eine Zeile je Meilenstein, Gruppen je Gewerk, zweistufige
   Achse, Zoom inkl. „Alles einpassen“/„Heute“, Premiere/Endprobenwoche als Markierungen. Nur
   Darstellung, Punkte bleiben.
2. **Dauer**: Migration `durationDays`, Formularfeld, Balken mit Fortschritt, Rauten, Vorlagen.
3. **Abhängigkeiten**: rechtwinklige Linien, Hervorheben bei Auswahl, Schalter kritischer Pfad.
4. **Direkt bearbeiten**: Kante ziehen, neue Aufgabe per Ziehen, Abhängigkeit per Ziehen,
   Tastatur.
5. **Filter & Extras**: Gewerk-Filter, nur offene, Wochenenden/Ferien, Karten als Unterzeilen (E2),
   PDF-Export im Gantt-Layout.
6. **Prüfung**: Vitest für Layout-Berechnung, E2E Ziehen/Bestätigen, Screenshots Tablet/Desktop
   hell+dunkel, Abnahme auf Staging.

## Checkliste

- [ ] Entscheidungen E1–E4
- [ ] Phase 1 Layout
- [ ] Phase 2 Dauer
- [ ] Phase 3 Abhängigkeiten
- [ ] Phase 4 Direkt bearbeiten
- [ ] Phase 5 Filter & Extras
- [ ] Phase 6 Prüfung/Release
