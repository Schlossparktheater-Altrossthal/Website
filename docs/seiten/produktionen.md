# Produktionen

## Zweck

Verwaltung der Produktionen (Stücke) inkl. Besetzung, Gewerke-Zuordnung, Szenen und
Auswertung der Rückmeldungen.

## Routen

- `/mitglieder/produktionen` – Übersicht
- `/mitglieder/produktionen/[showId]` – Detail einer Produktion
- `/mitglieder/produktionen/besetzung` – Rollen & Besetzung (`?rolle=<id>` öffnet die Rolle)
- `/mitglieder/produktionen/gewerke` – Gewerke-Übersicht
- `/mitglieder/produktionen/gewerke/[departmentId]` – einzelnes Gewerk
- `/mitglieder/produktionen/szenen` – Szenen mit Rollen und Ausstattung (`?szene=<id>`)
- `/mitglieder/produktionen/rueckmeldungen-auswertung` – Auswertung

## Permissions

- `PRIVATE.PRODUCTION.SHOW.MANAGE` – Stücke verwalten (häufigster Key)
- `PRIVATE.DEPARTMENT.OWN.VIEW` – eigene Abteilungen

## Wichtige Komponenten

- `src/app/(members)/mitglieder/produktionen/actions.ts` – Server Actions
- `src/app/(members)/mitglieder/produktionen/production-forms-client.tsx` – Formulare
- `src/app/(members)/mitglieder/produktionen/rollen-szenen/` – gemeinsame Rollen-/Szenenverwaltung (Seiten `besetzung` und `szenen` sind nur Hüllen)

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
- Rollen und Szenen: kompakte Listen, Bearbeiten im Bottom-Sheet (mobil) bzw. Dialog. Rolle: Name, Beschreibung, Farbe (`ROLE_COLOR_OPTIONS`), Besetzung Haupt/Zweit (sofort gespeichert, mit Benachrichtigung), Szenen (sofort). Szene: Nummer (1 oder 1.3, eindeutig), Titel, Ort, Tageszeit, Dauer, Rollen (Tippen: dabei → Hauptszene → entfernen), Ausstattung je Gewerk mit Status. `Scene.sequence` wird aus den Nummern neu gesetzt. Actions in `actions/roles-scenes.ts`, Loader `src/lib/produktionen/roles-scenes.ts`. Nur Regie/Board.
