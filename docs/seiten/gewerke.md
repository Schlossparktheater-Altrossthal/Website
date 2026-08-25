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
