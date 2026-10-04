# Produktionen

## Zweck

Verwaltung der Produktionen (Stücke) inkl. Besetzung, Gewerke-Zuordnung, Szenen und
Auswertung der Rückmeldungen.

## Routen

- `/mitglieder/produktionen` – Tab „Plan“: Kennzahlen, Zeitleiste (ab `md`), Agenda, Kalender; `?verwalten=1` öffnet „Produktionen verwalten“ (Sheet, aus dem Wechsler der Seitenleiste)
- `/mitglieder/produktionen/gewerke` – Tab „Gewerke“: alle Gewerke mit Kartenfortschritt und nächster Frist
- `/mitglieder/produktionen/[showId]` – Einstellungen einer Produktion (Premiere, Endprobenwoche, Onboarding)
- `/mitglieder/produktionen/stueck` – Stück: `?ansicht=` Ablauf (Standard) / rollen / auftritte; `?rolle=<id>` bzw. `?szene=<id>` öffnet das Panel
- `/mitglieder/produktionen/besetzung`, `/szenen` – leiten auf das Stück weiter
- `/mitglieder/produktionen/rueckmeldungen-auswertung` – Auswertung

## Permissions

- `PRIVATE.PRODUCTION.SHOW.MANAGE` – Stücke verwalten (häufigster Key)
- `PRIVATE.PRODUCTION.PLAN.MANAGE` – Produktionsplan pflegen (Meilensteine, Abhängigkeiten, Vorlagen); lesen dürfen alle aktiven Produktionsmitglieder, abhaken auch die Gewerk-Leitung
- `PRIVATE.DEPARTMENT.OWN.VIEW` – eigene Abteilungen

## Wichtige Komponenten

- `src/app/(members)/mitglieder/produktionen/actions/` – Server Actions (u. a. `production.ts`,
  `assignments.ts`, `roles-scenes.ts`, `department-settings.ts`, `ensemble.ts`, `status.ts`,
  `plan.ts`, `plan-templates.ts`, `reminders.ts`)
- `src/app/(members)/mitglieder/produktionen/production-forms-client.tsx` – Formulare
- `src/components/production/production-header.tsx` – gemeinsamer Kopf mit Tabs
- `src/app/(members)/mitglieder/produktionen/_plan/` – Plan (Zeitleiste, Agenda, Kalender, Formular); Actions in `actions/plan.ts`, `actions/plan-templates.ts`
- `src/lib/planning/` – Rechenkern (`schedule.ts`), Laden/Rechte (`plan-service.ts`), Vorlagen (`templates.ts`); Konzept in `docs/Plan/projektplanung-plan.md`
- `src/app/(members)/mitglieder/produktionen/stueck/` – Stück (Ablauf, Rollen, Auftrittsplan, Panels)

## Datenfluss

- Prisma-Modelle: `Production`, `Department`, `DepartmentMembership`, Casting-Einträge.
- Mitgliedschaften enden über `leaveProductionMembership` in `src/lib/produktionen/memberships.ts`
  (`status: "left"` + `leftAt`, Historie bleibt; zieht Rollen und Authentik-Gruppen nach). Genutzt
  von der Ensemble-Seite („Beenden“) und der Mitgliederverwaltung („Aus Produktion entfernen“).
- Jahreswechsel: `SeasonResetSettings` (geschützte Rollen) + `deactivateMembersForSeasonChange`
  in `src/lib/season-reset/`.

## Jahreswechsel (Season Reset)

- Beim Aktivieren einer neuen Produktion (`setActiveProductionAction`) bzw. beim Deaktivieren
  der alten (`clearActiveProductionAction`) werden alle Mitglieder außerhalb der geschützten
  Rollen deaktiviert (`deactivatedAt` + `sessionVersion`-Inkrement, sofortiges Zwangs-Logout).
- Beim allerersten Setzen einer aktiven Produktion wird niemand deaktiviert.
- Geschützte Rollen: `owner` immer; weitere Rollen konfigurierbar in der Mitgliederverwaltung.

## Besonderheiten / Altlasten

- Die Server Actions der Produktionen liegen domänenweise in `produktionen/actions/*.ts` (die
  frühere Sammeldatei `actions.ts` ist aufgeteilt).
- Stück (nur Regie/Board):
  - Ablauf: Szenen nach Akten (`Scene.act`, Akte mit Titel in `ShowAct`, bleiben auch leer bestehen), Spielzeit je Akt und gesamt. Umsortieren per Ziehen (Desktop) bzw. Pfeilen (mobil, am Aktrand in den Nachbarakt); Nummern `Akt.Position` und `sequence` werden dabei neu vergeben.
  - Rollen: unbesetzte oben, je Rolle Besetzung, Szenen, Bühnenzeit, Rollengröße (Onboarding-Code `acting_*`) und Auftrittsbereich.
  - Auftritte: Matrix Rollen × Szenen (Desktop), mobil Szenen mit Rollen-Chips; Tippen: dabei → Hauptszene → nicht dabei.
  - Panels: Rolle (Name, Beschreibung, Rollengröße, Farbe, Besetzung Haupt/Zweit und Szenen sofort gespeichert), Szene (Akt, Titel, Ort, Tageszeit, Dauer, Inhalt, Rollen, Ausstattung je Gewerk mit Status).
  - Actions `actions/roles-scenes.ts`, Loader `src/lib/produktionen/roles-scenes.ts`, Rollengrößen `src/lib/produktionen/role-sizes.ts`.
