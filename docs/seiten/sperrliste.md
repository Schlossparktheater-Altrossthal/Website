# Sperrliste

## Zweck

Erfassung der Nicht-Verfügbarkeiten („Sperrzeiten") der Ensemblemitglieder, damit die
Probenplanung freie Zeiten kennt.

## Routen

- `/mitglieder/sperrliste`

## Aufbau

Zwei Reiter (mobil als Auswahlfeld):

- **Mein Kalender** – Monatsraster (`MonthGrid`), daneben/darunter die Agenda des gewählten
  Tages mit Stufe, Ferien, Terminen und eigenem Status als Umschalter
  (Frei/Bevorzugt/Eingeschränkt/Gesperrt) samt optionalem Grund. „Zeitraum“ trägt mehrere Tage
  auf einmal ein (`/api/block-days/bulk`). Liste „Meine Einträge“ ab heute.
- **Team** – Desktop (ab `lg`): Matrix Personen × Tage, leere Zellen = frei, Kopf mit Anzahl
  Verfügbarer, Terminen und Bändern. Mobil: Tagesliste mit `AvailabilityBar` und nur den Namen
  der Ausnahmen. Tipp auf einen Tag öffnet die Tagesdetails. Filter Schauspiel/Gewerke,
  Namenssuche (Desktop), Schalter „Alle Tage“.

Tag-Stufen (`src/lib/sperrliste/day-tiers.ts`): `core` = bevorzugte Probentage (Einstellungen)
und Endprobenwoche der aktiven Produktion, `possible` = Ausnahme-Wochentage, Ferien, Feiertage,
Tage mit Termin/Probe, `off` = übrige Tage (in der Team-Ansicht standardmäßig ausgeblendet).
Hintergrund und Entscheidungen: `docs/sperrliste-redesign-plan.md`.

## Permissions

- `PRIVATE.REHEARSAL.BLOCKLIST.VIEW` – Ansicht
- `PRIVATE.REHEARSAL.BLOCKLIST.SETTINGS` – Einstellungen
- `PRIVATE.REHEARSAL.BLOCKLIST.EXPORT` – PDF-Export (Probentage der nächsten zwei Wochen)
- `PRIVATE.REHEARSAL.PLANNING.MANAGE` – „plant“: sieht die **Gründe** anderer und legt
  **Termine** an. Ohne dieses Recht liefert der Server keine fremden Gründe aus.

## Wichtige Komponenten

- `page.tsx` – lädt Einträge (ab Vormonat), Mitglieder, Ferien, Termine, Endprobenwoche
- `page-client.tsx` – Reiter, Aktionen (Termin, PDF, Einstellungen), gemeinsamer Monat
- `my-calendar.tsx`, `range-dialog.tsx` – eigener Kalender
- `team-view.tsx` – Team-Matrix, mobile Tagesliste, Tagesdetails
- `event-dialog.tsx` – Termine anlegen/bearbeiten/löschen
- `use-calendar-model.ts`, `use-my-entries.ts` – Tagesmodell und Speichern
- `settings-manager.tsx` – Einstellungen

## Datenfluss

- Prisma-Modell: `BlockedDay` – ein Eintrag pro Mitglied und Datum (`@@unique([userId, date])`).
  Die Art des Tages wird über den Enum `BlockedDayKind` abgebildet:
  `BLOCKED`, `LIMITED`, `PREFERRED`.
- Schreiben/Löschen der Sperrtage läuft über die API-Routen `src/app/api/block-days/*`
  (`GET`/`POST` in `route.ts`, `PATCH`/`DELETE` in `[id]/route.ts`, Massenoperationen in
  `bulk/route.ts`).
- Einstellungen (Sperrfrist `freezeDays`, bevorzugte/ausgenommene Wochentage sowie Ferien-
  und Feiertagsquellen) liegen als Singleton-Datensatz im Modell `SperrlisteSettings`
  (`id = "default"`) und werden über `src/lib/sperrliste-settings.ts` sowie
  `src/app/api/sperrliste/settings/route.ts` gelesen und gespeichert.
- Termine der Organisation: Modell `CalendarEvent` (Titel, Art, Beginn, Ende, ganztägig, Ort,
  Beschreibung, optional Produktion), API `src/app/api/calendar-events` (POST, PATCH, DELETE).
  `src/lib/calendar/entries.ts` führt Termine und angesetzte Proben zusammen; das Dashboard zeigt
  sie unter „Nächste Termine“.
- Feiertage werden über `src/lib/holidays.ts` aus externen ICS-Quellen geladen (konfigurierbar,
  mit statischen Fallbacks in `src/data/saxony-*.ts`); der Prüfstatus wird in
  `SperrlisteSettings` persistiert.

## Besonderheiten / Altlasten

- Feiertage werden über eine externe ICS-Quelle geladen.
