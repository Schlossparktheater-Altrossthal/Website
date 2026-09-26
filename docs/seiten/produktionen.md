# Produktionen

## Zweck

Verwaltung der Produktionen (Stücke) inkl. Besetzung, Gewerke-Zuordnung, Szenen und
Auswertung der Rückmeldungen.

## Routen

- `/mitglieder/produktionen` – Übersicht
- `/mitglieder/produktionen/[showId]` – Detail einer Produktion
- `/mitglieder/produktionen/stueck` – Stück: `?ansicht=` Ablauf (Standard) / rollen / auftritte; `?rolle=<id>` bzw. `?szene=<id>` öffnet das Panel
- `/mitglieder/produktionen/besetzung`, `/szenen` – leiten auf das Stück weiter
- `/mitglieder/produktionen/gewerke` – Gewerke-Übersicht
- `/mitglieder/produktionen/gewerke/[departmentId]` – einzelnes Gewerk
- `/mitglieder/produktionen/rueckmeldungen-auswertung` – Auswertung

## Permissions

- `PRIVATE.PRODUCTION.SHOW.MANAGE` – Stücke verwalten (häufigster Key)
- `PRIVATE.DEPARTMENT.OWN.VIEW` – eigene Abteilungen

## Wichtige Komponenten

- `src/app/(members)/mitglieder/produktionen/actions.ts` – Server Actions
- `src/app/(members)/mitglieder/produktionen/production-forms-client.tsx` – Formulare
- `src/app/(members)/mitglieder/produktionen/stueck/` – Stück (Ablauf, Rollen, Auftrittsplan, Panels)

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
- Stück (nur Regie/Board):
  - Ablauf: Szenen nach Akten (`Scene.act`, Akte mit Titel in `ShowAct`, bleiben auch leer bestehen), Spielzeit je Akt und gesamt. Umsortieren per Ziehen (Desktop) bzw. Pfeilen (mobil, am Aktrand in den Nachbarakt); Nummern `Akt.Position` und `sequence` werden dabei neu vergeben.
  - Rollen: unbesetzte oben, je Rolle Besetzung, Szenen, Bühnenzeit, Rollengröße (Onboarding-Code `acting_*`) und Auftrittsbereich.
  - Auftritte: Matrix Rollen × Szenen (Desktop), mobil Szenen mit Rollen-Chips; Tippen: dabei → Hauptszene → nicht dabei.
  - Panels: Rolle (Name, Beschreibung, Rollengröße, Farbe, Besetzung Haupt/Zweit und Szenen sofort gespeichert), Szene (Akt, Titel, Ort, Tageszeit, Dauer, Inhalt, Rollen, Ausstattung je Gewerk mit Status).
  - Actions `actions/roles-scenes.ts`, Loader `src/lib/produktionen/roles-scenes.ts`, Rollengrößen `src/lib/produktionen/role-sizes.ts`.
