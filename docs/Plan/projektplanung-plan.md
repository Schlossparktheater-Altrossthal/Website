# Plan: Produktionsplanung – Meilensteine, Zeitleiste und neue Produktionsseite

Stand: 2026-10-02. Phase 1–6 umgesetzt (main), Phase 7 (E2E, Staging-Abnahme, Release) offen. Checkliste am Ende wird gepflegt.

## Ziel

1. **Rückwärtsplanung ab Premiere (T−0)**: Meilensteine werden relativ zur Premiere oder zu anderen Meilensteinen geplant („GEMA 14 Tage vor Beginn Endprobenwoche“).
2. **Abhängigkeiten mit Vorlauf** und **automatische Verzugswarnung**: Wird ein Meilenstein überfällig, sieht man, was sich dahinter verschiebt und ob die Premiere in Gefahr ist. Kritischer Pfad = Kette ohne Puffer.
3. **Verknüpfung mit den Gewerke-Boards**: Karten hängen an Meilensteinen, der Meilenstein zeigt den Fortschritt.
4. **Jahresvorlage**: Der Ablauf wird einmal gebaut und jedes Jahr übernommen.
5. **Desktop/Tablet: Zeitleiste** mit Pfeilen; **mobil: Agenda** ab heute.
6. **Neue Produktionsseite** im Stil von Dashboard und Sperrliste, ersetzt die alte Übersicht.

Bewusst nicht: Dauern pro Aufgabe, Ressourcenplanung, volle CPM-Rechnung. Rahmen: ca. 10 Meilensteine pro Produktion, nur Fristen, gepflegt von der Leitung.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                                      | Stelle                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Kein fester Premierenanker; Termine stecken in `Show.dates` (JSON), dazu `finalRehearsalWeekStart/End`                                                                                                      | `schema.prisma`                           |
| 2   | Keine Meilensteine, keine Abhängigkeiten, keine Fristen über Gewerke hinweg                                                                                                                                 | –                                         |
| 3   | Kanban je Gewerk vorhanden (`DepartmentBoardColumn`/`DepartmentTask`, dnd-kit, BottomSheet mobil), ohne Bezug zu übergeordneten Fristen                                                                     | `meine-gewerke/board/*`                   |
| 4   | Probenphasen und Termine liegen als `CalendarEvent` vor und können als Bänder/Punkte in die Zeitleiste                                                                                                      | `schema.prisma`                           |
| 5   | `/mitglieder/produktionen` folgt altem Design: Werbe-Überschrift „Moderne Produktionsplanung“, dieselben Links dreifach, Zahlenkacheln ohne Handlungsbezug, Produktionsverwaltung als große Kartenliste     | Screenshot Staging 2026-10-01             |
| 6   | Gelungene Vorbilder: Dashboard („Nächste Termine“-Zeilen, Kennzahl-Kacheln, „Profil vervollständigen“ mit Ring) und Sperrliste (Kalender mit Legende, Umschalter, Tag → Panel rechts / `BottomSheet` mobil) | `dashboard`, `sperrliste/my-calendar.tsx` |

## Zielbild

### Datenmodell

```
Show                 + premiereAt DateTime?           // T−0-Anker

ShowMilestone        id, showId, departmentId? (verantwortliches Gewerk), title, description?,
                     kind (milestone|deadline|handover|review)   // Meilenstein, Frist, Bauabgabe, Abnahme
                     anchorType (premiere|finalRehearsalStart|milestone|fixed),
                     anchorMilestoneId?, offsetDays Int, fixedDate?,
                     dueAt DateTime (berechnet, gespeichert), doneAt?, doneById?,
                     calendarEventId? (gespiegelter Termin, z. B. Bauprobe), position
MilestoneDependency  fromId, toId, lagDays Int        // „from fertig“ + lagDays ≤ „to fällig“
PlanTemplate         id, name, items Json (title, kind, anchor, offsetDays, Abhängigkeiten, Gewerk-Blaupause)
DepartmentTask       + milestoneId?                   // siehe docs/Plan/gewerke-plan.md
```

- `dueAt` wird beim Speichern aus Anker + Offset berechnet; verschiebt sich die Premiere, werden alle abhängigen Daten neu berechnet (Vorschau vor dem Übernehmen).
- **Puffer** je Meilenstein = spätestes erlaubtes Datum (rückwärts über Abhängigkeiten) − geplantes `dueAt`. Puffer ≤ 0 → kritisch. Bei ~10 Einträgen trivial, serverseitig gerechnet (`src/lib/planning/schedule.ts`, gut testbar).
- **Verzug**: offener Meilenstein mit `dueAt < heute` → überfällig; Nachfolger zeigen „gefährdet durch X“.
- Zyklen in Abhängigkeiten werden beim Speichern abgelehnt.

### Rechte

- `PRIVATE.PRODUCTION.PLAN.MANAGE`: Plan pflegen (Meilensteine, Abhängigkeiten, Vorlage übernehmen). Standard: Leitung/Regie; über Gewerks-Blaupausen vergebbar.
- Gewerk-Leitung darf Meilensteine des eigenen Gewerks als erledigt markieren und Karten verknüpfen.
- Lesen: alle Produktionsmitglieder.

## UI-Konzept

Gilt für diesen Plan und für die Fortsetzung in `docs/Plan/gewerke-plan.md` (Blaupausen, Szenenbedarf, Budget).

### Vorbilder im Bestand

| Vorbild                                                          | Wird genutzt für                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Sperrliste: Tag antippen → Panel rechts / `BottomSheet` mobil    | Details von Karte, Objekt, Anforderung, Meilenstein; Tag in Zeitleiste/Kalender             |
| Dashboard „Nächste Termine“ (Datum-Kachel, Titel, Meta, Chevron) | Agenda des Plans, „Nächstes“ im Gewerk                                                      |
| Dashboard-Kennzahl-Kacheln                                       | Kopf des Plans: „T−290 Premiere“, „3 Fristen diese Woche“, „1 überfällig“                   |
| „Profil vervollständigen“ (Ring + Liste)                         | Fortschritt eines Meilensteins, Checklisten auf Karten                                      |
| Sperrlisten-Kalender mit Legende                                 | Kalenderansicht des Plans (Proben blau, Fristen als Ampelpunkte, Endprobenwoche als Balken) |
| Umschalter „Mein Kalender / Team“                                | „Zeitleiste / Agenda / Kalender“, „Board / Liste“                                           |

### Grundregeln

1. **Eine Kartenform**: Titel links, Fristabzeichen rechts, höchstens eine Chip-Zeile (Szenen, Checkliste `2/5`, Meilenstein, Gewerk-Farbe).
2. **Eine Farbsprache für Fristen**: grün im Plan · gelb < 7 Tage Puffer · rot überfällig/kritisch · grau erledigt. Überall gleich (Board, Zeitleiste, Agenda, Dashboard, Teams-Kacheln).
3. **Details nie als neue Seite**: Desktop Panel rechts, mobil `BottomSheet` – wie in der Sperrliste.
4. **Ein Hauptbutton pro Ansicht** (Primärfarbe); alles andere im „…“-Menü.
5. **Leere Zustände bieten die nächste Aktion** („Noch keine Meilensteine – Vorlage 2026 übernehmen?“).
6. **Keine Erklärtexte und Werbe-Überschriften**; höchstens eine Zeile Hinweis wie in der Sperrliste.

### Neue Produktionsseite `/mitglieder/produktionen`

```
In 80 Tagen um die Welt        ● Aktiv          [Bearbeiten …]
Premiere Sa 18.07.2027 · T−290
[ Plan ] Gewerke  Stück  Besetzung  Rückmeldungen
```

- **Kopf** kompakt wie im Gewerk-Portal; die Produktionsauswahl bleibt im Wechsler der Seitenleiste.
- **Produktionen anlegen/aktiv setzen/archivieren** wandern in ein Sheet aus dem Wechsler („Produktionen verwalten“) – keine eigene Kartenliste mehr.
- Tabs ersetzen die doppelten Buttons; „Gewerke“ ersetzt den Weg über „Meine Teams“ für die Leitung (Übersicht aller Gewerke mit Fortschritt und nächster Frist).
- Blaupausen-Verwaltung liegt in den Einstellungen (produktionsübergreifend).

### Tab „Plan“

**Kopf**: drei Kennzahl-Kacheln wie im Dashboard: `T−290 bis Premiere` · `3 Fristen in 14 Tagen` · `1 überfällig` (rot, antippbar → gefilterte Agenda).

**Desktop/Tablet – Zeitleiste**

```
        Jan      Feb      Mär      Apr      Mai      Jun      Jul
Proben  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓ Endproben
Bühne              ●────────────▶● Bauabgabe ─▶◆ Bauprobe
Technik                            ●──▶ Kabel vor Bodenschluss
Orga     ● GEMA ───────────────────────────────────────▶(−14 T)
                                                         ★ Premiere
```

- Zeilen = Gewerke (nur die mit Meilensteinen) + Zeile „Proben“ aus `CalendarEvent`.
- Punkte = Meilensteine in Ampelfarbe; Pfeile = Abhängigkeiten, kritische Kette rot hervorgehoben; Linie „heute“.
- Klick auf Punkt → Panel rechts (Details, verknüpfte Karten mit Fortschrittsring, „erledigt“, Abhängigkeiten).
- Zoom: Monat / Woche; Ziehen eines Punktes ändert das Offset (mit Vorschau der Folgeverschiebungen).

**Mobil – Agenda** (automatisch unter `md`)

- Gruppen „Überfällig“ · „Diese Woche“ · „Nächste Woche“ · „Später“, Zeilen im Format „Nächste Termine“: Datum-Kachel, Titel, Meta `Bühnenbau · 4/9 Karten`, Ampelpunkt, Chevron.
- Proben erscheinen kompakt dazwischen (grau), damit man den Kontext sieht.
- Tipp → `BottomSheet` mit Details und „Als erledigt markieren“.
- Umschalter oben: `Agenda | Kalender` (Kalender = Sperrlisten-Kalender mit Fristpunkten).

**Bearbeiten (Leitung)**: Hauptbutton „+ Meilenstein“ öffnet Sheet: Titel, Art, Gewerk, **Bezug** (`Premiere` / `Beginn Endprobenwoche` / `anderer Meilenstein` / `festes Datum`) + **Tage davor/danach**, darunter das berechnete Datum live. Abhängigkeit „muss fertig sein vor …“ mit Vorlauf.

**Leerzustand**: „Noch kein Plan. [Vorlage übernehmen] oder [Ersten Meilenstein anlegen]“.

### Gewerk-Board (Bezug zum Plan)

- Karte im Sheet: Feld „Gehört zu Meilenstein“ (Auswahl); Chip auf der Karte.
- Frist der Karte darf leer bleiben → erbt die Meilenstein-Frist (Abzeichen mit Kettensymbol).
- „Nächstes“ im Gewerk zeigt oben die nächste Meilenstein-Frist des Gewerks.

### Dashboard

- Karte „Nächste Fristen“ (nur wenn man in einem Gewerk mit Meilensteinen ist oder Planrecht hat), gleiche Zeilen wie „Nächste Termine“.

## Integration

- **Kalender/ICS**: Meilensteine der Art `review` (Bauprobe, Abnahme) erzeugen optional einen `CalendarEvent` (Gewerk-Termin) → Sperrliste, Zusagen, Abo.
- **Benachrichtigungen**: Push/Glocke an Gewerk-Leitung 7 und 2 Tage vor Frist und bei Überfälligkeit; an Planverantwortliche bei kritischem Verzug. Nutzt den vorhandenen Erinnerungs-Cron.
- **Saisonwechsel**: Vorlage aus dem Vorjahr übernehmen (Offsets bleiben, Daten neu berechnet).
- **Szenenbedarf** (`docs/Plan/gewerke-plan.md`): Objekte können einen Meilenstein bekommen („Requisiten komplett“).

## Phasen

1. **Datenmodell + Rechnung**: `premiereAt`, `ShowMilestone`, `MilestoneDependency`, Recht `PRIVATE.PRODUCTION.PLAN.MANAGE`; `schedule.ts` (Datum aus Anker, Puffer, kritisch, Zyklenprüfung) mit Unit-Tests. Premiere aus `Show.dates` vorbelegen (Migration prüfen).
2. **Neue Produktionsseite (Gerüst)**: Kopf, Tabs, Produktionsverwaltung ins Sheet am Wechsler, alte Übersicht entfernen. Bestehende Unterseiten (Stück, Besetzung, Zuweisung, Rückmeldungen) als Tabs einhängen.
3. **Plan mobil zuerst**: Kennzahl-Kacheln, Agenda, Meilenstein-Sheet (anlegen/bearbeiten/erledigt), Leerzustand.
4. **Zeitleiste Desktop/Tablet**: eigene SVG-Zeitleiste (keine Gantt-Bibliothek), Pfeile, kritische Kette, Panel rechts, Zoom; danach Ziehen mit Vorschau.
5. **Board-Verknüpfung**: `DepartmentTask.milestoneId`, Fortschritt am Meilenstein, geerbte Frist, Chip; Dashboard-Karte „Nächste Fristen“; Teams-Kacheln mit Fortschritt.
   5b. **Plan ↔ Kanban in beide Richtungen** (Nachtrag 2026-10-02): verknüpfte Karten im Meilenstein-Panel mit Sprung ins Board (`?ansicht=aufgaben&karte=`) und „+ Karte“ (`&neu=1&meilenstein=`); im Karten-Sheet alle Meilensteine der Produktion (eigenes Gewerk zuerst); geerbte Fristen zählen in „Als Nächstes“ und „überfällig“; Ampel Gelb bei < 7 Tagen Puffer und weniger als der Hälfte erledigter Karten oder bei einer Karte mit Datum nach der Frist; Rückfrage beim Abhaken mit offenen Karten; Board-Filter nach Meilenstein; Tab „Gewerke“ zählt nur Karten im Plan. Karten-Erinnerungen gibt es im Bestand nicht – entfällt.
6. **Vorlage + Benachrichtigungen**: `PlanTemplate` speichern/übernehmen, Saisonwechsel; Fristerinnerungen, Verzugswarnung, Kalender-Spiegelung.
7. **E2E, Screenshots mobil/Desktop, Staging, Release.**

Jede Phase einzeln auf Staging prüfbar; Schema-Änderungen additiv.

**Umsetzungsnotizen Phase 2–6 (2026-10-02):** Plan lesen alle aktiven Produktionsmitglieder; Tabs Stück/Zuweisung/Rückmeldungen nur mit Produktionsverwaltung. Vorlagen lassen sich nur in einen leeren Plan übernehmen; Gewerk-Blaupausen (`docs/Plan/gewerke-plan.md`) sind noch nicht Teil der Vorlage. Der eingebaute Vorschlag beantwortet die offene Frage nach der ersten Vorlage nur vorläufig – Abstände mit der Leitung abstimmen. Die Fristerinnerungen laufen in `/api/cron/rehearsal-reminders` mit, ohne neuen CronJob.

**Umsetzungsnotizen Phase 1:** Premiere wird aus dem ersten Datum in `Show.dates` (`YYYY-MM-DD` bzw. `YYYY-MM-DD/YYYY-MM-DD`) vorbelegt; andere Formate bleiben leer. Fehlt ein Anker, bleibt `dueAt` leer (Ampel „unscheduled“), damit ist auch eine Produktion ohne Premiere planbar (Anker „festes Datum“). Puffer: Endpunkte vor der Premiere sind durch die Premiere begrenzt, Meilensteine danach ohne Nachfolger haben keinen Puffer-Wert; „kritisch“ heißt Puffer ≤ 0 vor einem offenen Nachfolger oder Verzug durch einen überfälligen Vorgänger.

## Entscheidungen (2026-10-01)

- E1: Nur Fristen, keine Dauern; „kritischer Pfad“ = Kette ohne Puffer.
- E2: Plan pflegt die Leitung über eigenes Recht; als Recht auch über Blaupausen vergebbar.
- E3: Größenordnung ~10 Meilensteine → Zeitleiste statt vollem Gantt, eigene SVG-Umsetzung.
- E4: Mobil Agenda als Standard, Desktop Zeitleiste; gleiche Daten, gleiche Farben.
- E5: Produktionsseite wird komplett neu gebaut; Vorbilder sind Dashboard und Sperrliste (Panel/`BottomSheet`).
- E6: Kleinteiliges (Fertigungsschritte) bleibt als Checkliste auf Karten; in den Plan kommen nur gewerkeübergreifende Fristen, Abgaben und Abnahmen.

## Offene Fragen

- Welche ~10 Meilensteine gehören in die erste Vorlage? (Vorschlag sammeln mit Leitung: GEMA/Rechte, Genehmigungen, Bauabgabe Bühne, Technik vor Bodenschluss, Kostüm-Anprobe, Requisiten komplett, Bauprobe, Plakat/Druck, Ticketstart, Endprobenwoche.)
- Ist T−0 immer die Premiere, oder gibt es Produktionen mit anderem Anker (Event ohne Premiere)?

## Checkliste

- [x] Phase 1 Datenmodell + Rechnung (Migration `20261001140000_production_plan_milestones`, `src/lib/planning/schedule.ts`; `DepartmentTask.milestoneId` folgt in Phase 5)
- [x] Phase 2 Neue Produktionsseite (Gerüst): `ProductionHeader` mit Tabs, Verwaltung im Sheet (`?verwalten=1`), Tab „Gewerke“, Premiere in den Produktionseinstellungen
- [x] Phase 3 Plan mobil (Agenda, Kalender, BottomSheet, Meilenstein-Formular mit Live-Datum)
- [x] Phase 4 Zeitleiste Desktop (SVG, Pfeile, kritische Kette rot, Zoom Monat/Woche, Ziehen mit Vorschau)
- [x] Phase 5 Board-Verknüpfung (Chip, geerbte Frist), „Nächste Frist“ im Gewerk, Dashboard „Nächste Fristen“, Teams-Kacheln
- [x] Phase 5b Plan ↔ Kanban in beide Richtungen (Kartenliste, Sprünge, Warnungen, Filter)
- [x] Phase 6 Vorlagen (speichern/übernehmen, eingebauter Vorschlag mit 10 Meilensteinen als Schätzwerte), Fristerinnerungen im Erinnerungs-Cron (d7/d2/überfällig/kritisch), Kalender-Spiegelung für Abnahmen
- [ ] Phase 7 E2E/Release
