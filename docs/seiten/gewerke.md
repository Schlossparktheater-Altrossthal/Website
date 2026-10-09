# Gewerke

## Zweck

Zeigt den Mitgliedern ihre zugeordneten Gewerke (Abteilungen/Aufgaben).

## Routen

- `/mitglieder/meine-gewerke` – „Meine Teams“: Karten der eigenen Gewerke der aktiven Produktion (Regie/Board sehen zusätzlich alle weiteren)
- `/mitglieder/blaupausen` – Blaupausen-Verwaltung (Liste links, Editor rechts; mobil Liste → Sheet): Allgemein, Bausteine, Rechte je Rolle, Onboarding
- `/mitglieder/meine-gewerke/[slug]` – Gewerk-Portal mit `?ansicht=` Vor Ort (Standard) / aufgaben / termine / team; sichtbar für aktive Mitglieder des Gewerks und Regie/Board

## Permissions

- `PRIVATE.DEPARTMENT.OWN.VIEW` – eigene Abteilungen
- `PRIVATE.DEPARTMENT.TEMPLATE.MANAGE` – Blaupausen verwalten (Migration gibt es allen Rollen mit `PRIVATE.PRODUCTION.SHOW.MANAGE`)
- Gewerk-Rechte werden vererbt (`src/lib/departments/permission-inheritance.ts`): Recht der Blaupause für die eigene Rolle im Gewerk (`TemplatePermission`) + `grant` − `revoke` des Gewerks (`DepartmentPermission.mode`)

## Wichtige Komponenten

- `src/app/(members)/mitglieder/meine-gewerke/page.tsx` – Übersicht „Meine Teams“ (Team-Karten,
  Rollen-Kacheln, Beitritts-Liste)
- `src/app/(members)/mitglieder/meine-gewerke/team-ui.tsx` – `ViewSwitcher` (Portal-Ansichten),
  Farb-/Format-Helfer

## Datenfluss

- Prisma-Modell: `DepartmentMembership`
- Aufgaben (`DepartmentTask`) folgen den Statuswerten des Task-Modells; die Spalten des
  Aufgaben-Boards setzen den Status über „zählt als“ (siehe unten).

## Besonderheiten

- Offene Aufgaben stehen im Portal-Reiter „Aufgaben“ (`?ansicht=aufgaben`), nicht mehr in der
  Navigation: die frühere Seite `meine-gewerke/todos` ist entfallen.

## Teams & Zuweisung (Produktion)

- Route `/mitglieder/produktionen/zuweisung` – Regie/Board (`PRIVATE.PRODUCTION.SHOW.MANAGE`) sehen alles, Gewerk-Leitungen nur ihre Gewerke (Rollen-Reiter nur Regie/Board).
- Ansichten: Personen (Wünsche aus dem Onboarding, Zuweisung zu mehreren Gewerken, Funktion), Gewerke (Team, Anfragen, „Möchten mitmachen“), Rollen (Haupt-/Zweitbesetzung nach Schauspiel-Wunsch).
- Mobil öffnet die Detailansicht als Bottom-Sheet, ab `lg` steht sie rechts daneben.
- Code: `src/lib/departments/assignments.ts` (Daten), `produktionen/actions/assignments.ts` (Actions, Benachrichtigung an die Person), `produktionen/zuweisung/`.
- Gewerke gehören zu einer Produktion; Vorlagen: `DepartmentTemplate` (Wunsch-Codes → Gewerk), Anlage über `ensureProductionDepartments`.
- Leitungen: Wer ein Gewerk leitet, sieht „Teams & Zuweisung“ im Menü (auch ohne Produktionsrecht), startet in der Gewerke-Ansicht und sieht nur die eigenen Gewerke. Eine Person kann in einem Gewerk Leitung und in anderen Mitglied sein. Die Leitung ernennen nur Regie/Board.
- Keine automatische Zuteilung aus Wünschen: Wünsche sind nur Vorschläge, Zugehörigkeit entsteht ausschließlich durch Zuweisung oder angenommene Anfrage. Wer aktiv in einem Gewerk ist, erhält die Gewerkeplanung (`PRIVATE.DEPARTMENT.OWN.VIEW`) direkt aus der Zugehörigkeit.
- Aufgaben-Board (`?ansicht=aufgaben`): Spalten pro Gewerk (Standard Offen/In Arbeit/Review/Erledigt, anpassbar), jede Spalte „zählt als“ offen/in Arbeit/erledigt und setzt damit `DepartmentTask.status`. Mitglieder legen an, bearbeiten, verschieben und kommentieren; Gäste lesen nur; Leitung, Vertretung und Regie verwalten Spalten und löschen fremde Aufgaben. Zuständige werden benachrichtigt. Code: `src/lib/departments/board.ts`, `meine-gewerke/board-actions.ts`, `meine-gewerke/board/`.

## Vor Ort und Übergabe (`docs/Plan/uebergabe-plan.md`)

- Startreiter „Vor Ort“: „+ Aufgabe“ (Titel + Schritte, eine Zeile je Schritt) und „Feierabend“, angepinnte Hinweise, letzte Übergabe, „Gerade dran“ (in Arbeit, jemand ist dran, Achtung oder neu – mit offenen Schritten zum Abhaken), einklappbar „Seit deinem letzten Besuch“, darunter eigene Termine und Aufgaben.
- Karte (Board und Ausstattungsstück): Arbeitsblock oben – Status Offen/In Arbeit/Fertig (erste Spalte mit diesem Status), „Ich bin dran“ (12 h), „Achtung“, Schritte (erster offener = „Als Nächstes“, Liste einfügen = mehrere Schritte), Notizen & Verlauf. Frist, Zuständige, Meilenstein, Beschreibung unter „Details“. Board-Kachel hakt den nächsten Schritt direkt ab.
- „Seit deinem letzten Besuch“: neuer Besuch nach 30 min Pause (`DepartmentVisit`); Verlauf in `TaskActivity`, mitgeschrieben in allen Karten-/Objekt-Aktionen (`logTaskActivity`/`logObjectActivity`).
- Einstellungen (Leitung/Vertretung): Push bei Feierabend (niemand/Leitung/alle), wer Hinweise und Achtung pflegt, wer abgehakte Schritte wieder öffnen darf.
- Code: `src/lib/departments/handover.ts`, `activity-format.ts`, `meine-gewerke/handover-actions.ts`, `meine-gewerke/handover/`.

## Termine (`?ansicht=termine`)

- Gewerk-Termine sind `CalendarEvent` mit `departmentId` (ein Termin-System, `DepartmentEvent` ist entfallen). Sie erscheinen nur bei Mitgliedern des Gewerks: Portal, Dashboard, „Meine Proben“ und Kalender-Abo – nicht im allgemeinen Kalender der Sperrliste.
- Zu-/Absage (`CalendarEventResponse`: Dabei, Vielleicht, Nicht dabei) durch aktive Mitglieder inkl. Gäste; erneuter Tipp nimmt die Antwort zurück. Abgesagte Termine fallen aus Abo, Dashboard und Zeitleiste.
- Anlegen, Bearbeiten, Löschen: Leitung, Vertretung, Regie/Board. Neue Termine benachrichtigen das Team, verschobene ebenfalls, gelöschte die Zusagenden.
- Sperrliste: Karte und Detail zeigen, wer laut Sperrliste an dem Tag gesperrt oder eingeschränkt ist; das Formular warnt schon bei der Datumswahl.
- Server-Actions in `meine-gewerke/event-actions.ts`, Loader `src/lib/departments/events.ts`, UI `meine-gewerke/events/team-events.tsx`.

## Rollenportal (`/mitglieder/meine-gewerke/rolle/[id]`)

- „Meine Teams“ zeigt oben „Meine Rolle(n)“ als Kacheln (Besetzungsart, Szenenzahl, Partner/Zweitbesetzung); Regie/Board sehen zusätzlich alle Rollen der Produktion.
- Eine Besetzung in einer laufenden/geplanten Produktion gibt wie eine Gewerk-Zugehörigkeit `PRIVATE.DEPARTMENT.OWN.VIEW` (Darsteller ohne Gewerk sehen „Meine Teams“).
- Sichtbar für Besetzung, Regie/Board und aktive Gewerk-Mitglieder der Produktion (z. B. Kostüm, Maske).
- Ansichten: Überblick (Besetzung inkl. Zweitbesetzung, nächste Proben der Besetzung, gemeinsame Rollennotizen – pflegen Besetzung und Regie), Szenen (Szenen der Rolle mit Partnern), Ausstattung (Breakdown-Einträge der Gewerke für diese Szenen mit Status).
- Loader `src/lib/departments/roles.ts`, Action `meine-gewerke/role-actions.ts`.

## Gewerke verwalten, Beitritt und Dateien (Phase 6)

- Regie/Board: „Gewerk anlegen“-Kachel in „Meine Teams“ und „Teams & Zuweisung“ öffnet `create-department-panel.tsx`: „Aus Blaupause“ (Liste, schon vorhandene ausgeblendet, Archiviertes wird wiederhergestellt) oder „Neue Blaupause“ (Name, Farbe, Bausteine – Blaupause und Gewerk entstehen zusammen). Jedes Gewerk hat eine Blaupause (`Department.templateId` Pflicht, Phase 9).
- „Bearbeiten“ im Portal-Kopf (Name, Beschreibung, Farbe, Beitritt mit Prüfung, Archivieren). Actions `produktionen/actions/department-settings.ts`. Die alten Seiten `produktionen/gewerke/*` und `meine-gewerke/todos` sind entfernt.
- Mitglieder: „Weitere Gewerke – mitmachen?“ in „Meine Teams“: Beitreten (ohne Prüfung) oder Anfrage (Leitung/Vertretung werden benachrichtigt), Anfrage zurückziehen (`meine-gewerke/actions.ts`).
- Dateien im Team-Tab: `DepartmentDocument` (statt FileLibrary, die keine Gewerk-Rechte kennt). Upload per `POST /api/departments/[id]/documents` (je bis 15 MB, Mitglieder ohne Gäste), Download über `GET …/documents/[documentId]`, Löschen durch Hochladende oder Leitung/Vertretung/Regie.

## Gewerk-Termine: Auswahl und Terminfinder

Leitung, Vertretung und Regie laden beim Anlegen das ganze Team oder eine Auswahl von Mitgliedern ein (gespeichert als Personen-Regeln). Termine mit Auswahl erscheinen in „Meine Termine“ und im Kalender-Abo nur bei den Eingeladenen. „Gemeinsamen Termin finden“ schlägt Tage für die Eingeladenen vor (Sperrliste und andere Termine zur gewählten Uhrzeit) und übernimmt das Datum ins Formular.
