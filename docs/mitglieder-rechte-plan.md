# Plan: Mitglieder- & Rechteverwaltung – Redesign und produktionsbezogene Rechte

Stand: 2026-09-26. Arbeitsdokument, um die Umsetzung auch in späteren Sessions fortsetzen zu können.
Fortschritt wird in der Checkliste am Ende gepflegt. Oberstes Ziel: **intuitive Bedienung** – wer die Seite
zum ersten Mal öffnet, soll ohne Erklärung finden, was er sucht, und verstehen, warum jemand ein Recht hat.

## Ausgangslage (Review 2026-09-26, Staging-Screenshots Desktop 1440 / Mobil 390)

### Optik / Bedienung

| #   | Befund                                                                                                                                                                                              | Stelle                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| O1  | Mitgliederverwaltung ~5 500 px (Desktop) bzw. ~15 000 px (Mobil) hoch; vier seltene Einstellungsblöcke (Einladungen, Geschützte Rollen, Saison, Datenpflege) stehen vor der täglich genutzten Liste | `mitgliederverwaltung/page.tsx`                      |
| O2  | Tabellenzeilen ~95 px: bis zu 4 farbige Rund-Buttons (umbrechend), Status-Badge unter dem Namen, meist leere Spalte „Zusätzliche Rollen“                                                            | `components/members/members-table.tsx`               |
| O3  | Deaktivierte Mitglieder (Mehrheit) gleichrangig mit aktiven gelistet, kein Status-Filter                                                                                                            | `members-table.tsx`                                  |
| O4  | Rollen-Chips brechen mobil dreizeilig um, Suchfeld schmal                                                                                                                                           | `members-table.tsx`                                  |
| O5  | Mobil ist die Tabelle nur gestaucht statt einer Listenansicht                                                                                                                                       | `members-table.tsx`                                  |
| O6  | Rechte-Matrix lädt komplett zugeklappt → wirkt leer                                                                                                                                                 | `permissions/permission-workbench-client.tsx`        |
| O7  | Spaltenköpfe zeigen technische Schlüssel (`member`, `board`, `cast` …), Mitgliederverwaltung zeigt deutsche Labels                                                                                  | `permission-workbench-client.tsx`, `lib/roles.ts`    |
| O8  | Stift- und Ziehgriff-Icons unter jeder Rollenspalte; Leerfläche rechts neben der Matrix                                                                                                             | `permission-workbench-client.tsx`                    |
| O9  | Mobil: Rollen-Select + Akkordeon ok, aber ohne Zähler („3/8“) und nicht sticky                                                                                                                      | `permission-workbench-client.tsx`                    |
| O10 | Navigation: „Mitgliederverwaltung“, „Rechteverwaltung“ und Alt-Route `/rollenverwaltung` (Redirect) – drei Begriffe für zwei Seiten                                                                 | `members-app-shell.tsx`, `rollenverwaltung/page.tsx` |

### Inhalt / Datenmodell

| #   | Befund                                                                                                                                                                                                | Stelle                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| I1  | Vier Quellen für Rechte: `User.role`, `UserRole`, `AppRole`/`UserAppRole` (z. B. „regie“), `DepartmentPermission` über Gewerk-Mitgliedschaft. Für Admins nicht nachvollziehbar, woher ein Recht kommt | `lib/permissions.ts` (`resolveRoleContext`, `hasPermission`)   |
| I2  | Produktionsrollen (`ProductionMembership.roles`) werden via `computeEffectiveRoles` in globale `UserRole` gespiegelt → „tech“ in Produktion A gibt Technik-Rechte in allen Produktionen               | `lib/produktionen/production-roles.ts`                         |
| I3  | `hasPermission(user, key)` kennt keinen Produktionskontext; `PRIVATE.PRODUCTION.SHOW.MANAGE` (28 Aufrufe) und Probenplanung gelten global                                                             | `lib/permissions.ts`                                           |
| I4  | „Regie“ ist eine globale Custom-Rolle statt einer Funktion in einer Produktion                                                                                                                        | `AppRole`                                                      |
| I5  | Mitgliederverwaltung zeigt keinen Produktionsbezug (wer ist in welcher Produktion mit welcher Funktion?)                                                                                              | `members-table.tsx`                                            |
| I6  | „Geschützte Rollen beim Jahreswechsel“ und „Saison abschließen“ sind zwei getrennte Blöcke für einen Vorgang                                                                                          | `season-reset-settings-panel.tsx`, `season-closeout-panel.tsx` |

## Zielbild

### Informationsarchitektur

Navigation „Verwaltung“:

- **Mitglieder** (`/mitglieder/mitgliederverwaltung`) mit Tabs (URL-Parameter `?tab=`, damit verlinkbar und Zurück-Taste funktioniert):
  1. **Mitglieder** (Standard) – Liste
  2. **Einladungen** – `MemberInviteManager` (Badge mit Anzahl aktiver Links)
  3. **Saison** – Geschützte Rollen + Saison abschließen als _ein_ geführter Ablauf (1. Welche Rollen bleiben? 2. Vorschau 3. Ausführen)
  4. **Datenpflege** – Inhalt von `/aufbewahrung` (Route bleibt als Redirect)
- **Rollen & Rechte** (`/mitglieder/rechte`) mit Tabs **Rechte** (Matrix) und **Rollen** (Liste der Rollen: anlegen, umbenennen, sortieren, löschen, Mitgliederzahl je Rolle).
- `/rollenverwaltung` bleibt Redirect.

### Mitgliederliste (Desktop)

```
[🔍 Name oder E-Mail suchen ................................] [Filter ▾] [+ Mitglied]
Aktiv ● 18   Deaktiviert 25   Alle 43        Produktion: [In 80 Tagen ▾]
┌───────────────────────────────────────────────────────────────────────────────┐
│ ○ Name ▲             Produktion / Funktion        Rollen              Login  ⋯ │
│ ● Anton Jakob        In 80 Tagen · Ensemble       Mitglied            SSO    ⋯ │
│ ● Bianca Milke       In 80 Tagen · Technik        Vorstand, Finanzen  SSO    ⋯ │
└───────────────────────────────────────────────────────────────────────────────┘
```

- Zeilenhöhe ~48 px, ganze Zeile klickbar → Detailseite. Kein Button-Wald: eine „⋯“-Aktion (`ActionDropdownMenu`) mit Bearbeiten, Rollen, Ansehen als (Impersonation), Deaktivieren/Reaktivieren, Löschen (rot, mit `ConfirmDialog`).
- Status als farbiger Punkt vor dem Namen (grün aktiv, grau deaktiviert) plus Tooltip; Standardfilter **Aktiv**.
- Eine Spalte **Rollen** (System- und eigene Rollen zusammen, deutsche Labels, max. 2 Chips + „+1“).
- Spalte **Produktion / Funktion** aus `ProductionMembership` der gewählten Produktion (Standard: aktive Ansicht-Produktion).
- Filter-Popover: Rolle (Mehrfachauswahl), Gewerk, Login-Art, „ohne Fotoerlaubnis“, „Onboarding offen“. Aktive Filter als entfernbare Chips über der Tabelle.
- Sortierbar nach Name, zuletzt aktiv.
- Mehrfachauswahl (Checkbox) mit Aktionsleiste unten: Rolle hinzufügen/entfernen, deaktivieren, zu Produktion hinzufügen.
- Leerer Zustand mit Hinweis + Knopf „Filter zurücksetzen“.

### Mitgliederliste (Mobil)

- Sticky Kopf: Suche volle Breite + Filter-Icon (öffnet `BottomSheet`) + Status-`SegmentedControl` (Aktiv/Deaktiviert/Alle).
- Pro Person eine `ListRow`: Avatar mit Statuspunkt, Name, darunter „Ensemble · Mitglied“ einzeilig gekürzt, Chevron. Tippen → Detailseite. Wischen/Long-Press nicht nötig.
- „+ Mitglied“ als schwebender Button unten rechts.

### Mitglied-Detailseite

Bestehende Seite (`[userId]/page.tsx`, 1 600 Zeilen) in Abschnitte gliedern: **Übersicht · Produktionen · Rollen & Rechte · Profil & Daten · Verlauf**. Neu im Abschnitt „Rollen & Rechte“:

- Globale Rollen als Checkbox-Liste mit Beschreibung („Vorstand – sieht Finanzen und …“).
- Produktionsrollen je Produktion (nur Anzeige + Link zur Besetzung/Produktion; Vergabe dort).
- **Effektive Rechte mit Herkunft**: Liste gruppiert nach Kategorie, jedes Recht mit Quelle(n) als Chip („Rolle Vorstand“, „Gewerk Technik“, „In 80 Tagen · Regie“). Beantwortet „warum darf X das?“.

### Rechte-Matrix (Desktop)

- Kopf sticky, erste Spalte sticky; deutsche Rollennamen, darunter Mitgliederzahl („12 Pers.“). Keine Icons im Kopf – Bearbeiten im Tab „Rollen“ bzw. Kopf-Klick öffnet Popover mit Umbenennen/Löschen.
- Alle Gruppen standardmäßig **aufgeklappt** als Abschnittsüberschriften (nicht als Akkordeon); Suche filtert live und hebt Treffer hervor.
- Owner/Admin als ausgegraute Spalte mit Häkchen und Hinweis „immer alle Rechte“ statt nur im Untertitel.
- Jede Zeile: Label + einzeilige Beschreibung (Tooltip für Rest), Badge **Global** oder **Produktion** (ab Phase 2).
- Änderungen sofort speichern mit Toast + „Rückgängig“ (statt Speichern-Knopf); gefährliche Rechte (Rechte verwalten, Server) mit Bestätigung.
- Klick auf Gruppenzeile setzt/entfernt alle Rechte der Gruppe für eine Rolle (Tri-State-Checkbox).

### Rechte-Matrix (Mobil)

- Sticky: Rollen-Select + Suche.
- Gruppen als Akkordeon mit Zähler „Proben 3/8“; erste Gruppe offen.
- Schalter (`Switch`) statt Checkbox, ganze Zeile tippbar (≥ 44 px).

### Produktionsbezogene Rechte (Phase 2)

- Jedes Recht bekommt einen **Scope**: `global` (Admin, Server, Website, Finanzen, Mitglieder) oder `production` (Proben, Sperrliste, Besetzung, Szenen, Gewerke, Produktion verwalten).
- `hasPermission(user, key, { showId })`: Bei `production`-Rechten zählen nur Rollen aus der `ProductionMembership` dieser Produktion (+ globale Rollen, die das Recht produktionsübergreifend gewähren, z. B. Vorstand/Admin).
- `computeEffectiveRoles` spiegelt Produktionsrollen nicht mehr in `UserRole`; `UserRole` enthält nur noch globale Rollen.
- „Regie“ (und ggf. „Produktionsleitung“) wird Produktionsrolle (`ProductionMembership.roles`), die bisherige `AppRole` wird migriert.
- Gewerk-Rechte (`DepartmentPermission`) wirken nur in der Produktion, zu der das Gewerk gehört (sofern Gewerke produktionsbezogen sind – prüfen).
- Rechte-Matrix erhält Umschalter **Globale Rollen | Produktionsrollen**; die Spalten sind dieselben für alle Produktionen (Rollen-_Definition_ bleibt global, nur die _Zuweisung_ ist pro Produktion).

## Komponenten

Wiederverwenden (`src/components/ui`): `tabs`, `segmented-control`, `list-row`, `action-dropdown-menu`, `bottom-sheet`, `confirm-dialog`, `data-table`, `switch`, `checkbox`, `popover`, `tooltip`, `badge`, `section-header`, `page-header`.

Neu:

- `ui/filter-bar.tsx` – Suche + Filter-Popover/BottomSheet + entfernbare Filter-Chips (auch für andere Listen nutzbar).
- `ui/status-dot.tsx` – Statuspunkt mit Tooltip.
- `ui/bulk-action-bar.tsx` – schwebende Leiste bei Mehrfachauswahl.
- `members/role-chips.tsx` – einheitliche Rollen-Chips mit deutschen Labels und „+n“.
- `members/member-list-row.tsx` – mobile Zeile.
- `members/effective-permissions.tsx` – Rechte mit Herkunft.
- `members/permissions/permission-matrix.tsx` + `permission-role-list.tsx` – Aufteilung des 620-Zeilen-Workbench-Clients.
- `members/season-wizard.tsx` – ersetzt `SeasonResetSettingsPanel` + `SeasonCloseoutPanel`.

Alles tweakcn-Theme-Tokens, hell/dunkel, keine festen Farben.

## Entscheidungen

- E1: Tabs per URL-Parameter statt Unterseiten (ein Ladevorgang, verlinkbar). → angenommen
- E2: Produktionsrollen werden nur auf Produktions-/Besetzungsseite vergeben, Mitgliederverwaltung zeigt sie an. → angenommen
- E3: Phase 2 erst nach Prod-Release von Phase 1 und nur mit Migrationstest auf Prod-Kopie (`website-staging-db-sync`). → angenommen
- E4 (offen): Sollen Vorstand/Admin produktionsbezogene Rechte automatisch in allen Produktionen haben? Vorschlag: ja für Admin/Owner, Vorstand nur Lesen.

## Checkliste

### Phase 1 – UI (ohne Schemaänderung)

- [x] 1.1 Tabs Mitglieder/Einladungen/Saison/Datenpflege, Navigation umbenennen (Mitglieder, Rollen & Rechte)
- [x] 1.2 `FilterBar`, `StatusDot`, `RoleChips` bauen; Mitgliedertabelle kompakt mit „⋯“-Menü, Standardfilter Aktiv
- [x] 1.3 Spalte Produktion/Funktion + Produktionsfilter
- [x] 1.4 Mobile Listenansicht mit BottomSheet-Filter und FAB
- [ ] 1.5 Mehrfachauswahl + Bulk-Aktionen
- [x] 1.6 Rechte-Matrix: deutsche Labels, sticky Kopf/Spalte, aufgeklappt, Owner/Admin-Spalte, Sofort-Speichern mit Rückgängig
- [x] 1.7 Tab „Rollen“ (Rollenliste statt Icons im Matrixkopf)
- [x] 1.8 Mobile Matrix: sticky Select, Zähler, Switches
- [ ] 1.9 Saison-Assistent (Geschützte Rollen + Abschluss)
- [ ] 1.10 Detailseite gliedern + „Effektive Rechte mit Herkunft“
- [ ] 1.11 E2E-Tests + Screenshots (mobile, tablet, desktop, hell/dunkel), Staging, Release

### Phase 2 – Produktionsbezogene Rechte

- [ ] 2.1 Scope je Permission (`global`/`production`) in `DEFAULT_PERMISSION_DEFINITIONS`
- [ ] 2.2 `hasPermission`/`getUserPermissionKeys` mit optionalem `showId`; Tests
- [ ] 2.3 Aufrufer produktionsbezogener Rechte auf `showId` umstellen (v. a. `PRIVATE.PRODUCTION.SHOW.MANAGE`, Probenplanung, Sperrliste)
- [ ] 2.4 `computeEffectiveRoles`-Spiegelung entfernen, Migration `UserRole` bereinigen
- [ ] 2.5 Regie als Produktionsrolle, Migration der `AppRole` „regie“
- [ ] 2.6 Matrix-Umschalter Global/Produktion, Scope-Badges
- [ ] 2.7 Migrationstest auf Prod-Kopie, Staging, Release
