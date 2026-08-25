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

## Besonderheiten / Altlasten

- `produktionen/actions.ts` ist mit 1200+ Zeilen die größte Actions-Datei (Aufteilung in P5).
- Der Besetzungsbereich hat eigene Utils (`casting-utils.ts`).
