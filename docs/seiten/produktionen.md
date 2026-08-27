# Produktionen

## Zweck

Verwaltung der Produktionen (Stücke) inkl. Besetzung, Gewerke-Zuordnung, Szenen und
Auswertung der Rückmeldungen.

## Routen

- `/mitglieder/produktionen` – Übersicht
- `/mitglieder/produktionen/[showId]` – Detail einer Produktion
- `/mitglieder/produktionen/besetzung` – Besetzung
- `/mitglieder/produktionen/gewerke` – Gewerke-Übersicht
- `/mitglieder/produktionen/gewerke/[departmentId]` – einzelnes Gewerk
- `/mitglieder/produktionen/szenen` – Szenen
- `/mitglieder/produktionen/rueckmeldungen-auswertung` – Auswertung

## Permissions

- `PRIVATE.PRODUCTION.SHOW.MANAGE` – Stücke verwalten (häufigster Key)
- `PRIVATE.DEPARTMENT.OWN.VIEW` – eigene Abteilungen

## Wichtige Komponenten

- `src/app/(members)/mitglieder/produktionen/actions.ts` – Server Actions
- `src/app/(members)/mitglieder/produktionen/production-forms-client.tsx` – Formulare
- `src/app/(members)/mitglieder/produktionen/besetzung/` – Besetzungsbereich

## Datenfluss

- Prisma-Modelle: `Production`, `Department`, `DepartmentMembership`, Casting-Einträge.
- Jahreswechsel: `SeasonResetSettings` (geschützte Rollen) + `deactivateMembersForSeasonChange`
  in `src/lib/season-reset/`.

## Jahreswechsel (Season Reset)

- Beim Aktivieren einer neuen Produktion (`setActiveProductionAction`) bzw. beim Deaktivieren
  der alten (`clearActiveProductionAction`) werden alle Mitglieder außerhalb der geschützten
  Rollen deaktiviert (`deactivatedAt` + `sessionVersion`-Inkrement, sofortiges Zwangs-Logout).
- Beim allerersten Setzen einer aktiven Produktion wird niemand deaktiviert.
- Geschützte Rollen: `owner` immer; weitere Rollen konfigurierbar in der Mitgliederverwaltung.

## Besonderheiten / Altlasten

- `produktionen/actions.ts` ist mit 1200+ Zeilen die größte Actions-Datei (Aufteilung in P5).
- Der Besetzungsbereich hat eigene Utils (`casting-utils.ts`).
