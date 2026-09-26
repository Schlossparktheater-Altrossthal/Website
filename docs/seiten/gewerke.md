# Gewerke

## Zweck

Zeigt den Mitgliedern ihre zugeordneten Gewerke (Abteilungen/Aufgaben) und offene Todos.

## Routen

- `/mitglieder/meine-gewerke` – Übersicht der eigenen Gewerke
- `/mitglieder/meine-gewerke/[slug]` – Detailansicht eines Gewerks
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
