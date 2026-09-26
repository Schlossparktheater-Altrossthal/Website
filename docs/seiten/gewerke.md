# Gewerke

## Zweck

Zeigt den Mitgliedern ihre zugeordneten Gewerke (Abteilungen/Aufgaben) und offene Todos.

## Routen

- `/mitglieder/meine-gewerke` – „Meine Teams“: Karten der eigenen Gewerke der aktiven Produktion (Regie/Board sehen zusätzlich alle weiteren)
- `/mitglieder/meine-gewerke/[slug]` – Gewerk-Portal mit `?ansicht=` Übersicht (Für mich, Termine, Ansprechpartner) / aufgaben / team; sichtbar für aktive Mitglieder des Gewerks und Regie/Board
- `/mitglieder/meine-gewerke/todos` – offene Aufgaben

## Permissions

- `PRIVATE.DEPARTMENT.OWN.VIEW` – eigene Abteilungen

## Wichtige Komponenten

- `src/app/(members)/mitglieder/meine-gewerke/` – Seiten des Bereichs
- `src/app/(members)/mitglieder/meine-gewerke/department-select.tsx` – Abteilungsauswahl

## Datenfluss

- Prisma-Modell: `DepartmentMembership`
- Status der Todos folgt den Statuswerten des Task-Modells.

## Besonderheiten

- Enthält einen „todo"-Status, der in der Navigation neben der Gewerke-Übersicht angezeigt wird
  (siehe `members-navigation.test.ts`).

## Teams & Zuweisung (Produktion)

- Route `/mitglieder/produktionen/zuweisung` – Regie/Board (`PRIVATE.PRODUCTION.SHOW.MANAGE`) sehen alles, Gewerk-Leitungen nur ihre Gewerke (Rollen-Reiter nur Regie/Board).
- Ansichten: Personen (Wünsche aus dem Onboarding, Zuweisung zu mehreren Gewerken, Funktion), Gewerke (Team, Anfragen, „Möchten mitmachen“), Rollen (Haupt-/Zweitbesetzung nach Schauspiel-Wunsch).
- Mobil öffnet die Detailansicht als Bottom-Sheet, ab `lg` steht sie rechts daneben.
- Code: `src/lib/departments/assignments.ts` (Daten), `produktionen/actions/assignments.ts` (Actions, Benachrichtigung an die Person), `produktionen/zuweisung/`.
- Gewerke gehören zu einer Produktion; Vorlagen: `DepartmentTemplate` (Wunsch-Codes → Gewerk), Anlage über `ensureProductionDepartments`.
- Leitungen: Wer ein Gewerk leitet, sieht „Teams & Zuweisung“ im Menü (auch ohne Produktionsrecht), startet in der Gewerke-Ansicht und sieht nur die eigenen Gewerke. Eine Person kann in einem Gewerk Leitung und in anderen Mitglied sein. Die Leitung ernennen nur Regie/Board.
- Keine automatische Zuteilung aus Wünschen: Wünsche sind nur Vorschläge, Zugehörigkeit entsteht ausschließlich durch Zuweisung oder angenommene Anfrage. Wer aktiv in einem Gewerk ist, erhält die Gewerkeplanung (`PRIVATE.DEPARTMENT.OWN.VIEW`) direkt aus der Zugehörigkeit.
- Aufgaben-Board (`?ansicht=aufgaben`): Spalten pro Gewerk (Standard Offen/In Arbeit/Review/Erledigt, anpassbar), jede Spalte „zählt als“ offen/in Arbeit/erledigt und setzt damit `DepartmentTask.status`. Mitglieder legen an, bearbeiten, verschieben und kommentieren; Gäste lesen nur; Leitung, Vertretung und Regie verwalten Spalten und löschen fremde Aufgaben. Zuständige werden benachrichtigt. Code: `src/lib/departments/board.ts`, `meine-gewerke/board-actions.ts`, `meine-gewerke/board/`.
