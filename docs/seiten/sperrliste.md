# Sperrliste

## Zweck

Erfassung der Nicht-Verfügbarkeiten („Sperrzeiten") der Ensemblemitglieder, damit die
Probenplanung freie Zeiten kennt.

## Routen

- `/mitglieder/sperrliste`
- `/api/calendar/feed/<token>.ics` – persönlicher Kalender-Feed (ohne Anmeldung, Token ist die Berechtigung)

## Aufbau

Zwei Ansichten, umgeschaltet per `SegmentedControl` (`?ansicht=team`):

- **Mein Kalender** – Monatsraster mit Kalenderwochen (`MonthGrid`). Am Desktop zeigen die
  Zellen Termine; rechts stehen die Tagesdetails. Mobil öffnet ein Tipp auf einen Tag ein
  Bottom-Sheet mit Terminen und der Statusauswahl (`StatusPicker`, 2×2 große Flächen) samt
  optionalem Grund. „Zeitraum“ trägt mehrere Tage ein (`/api/block-days/bulk`). Liste „Meine
  Einträge“ ab heute.
- **Team** – auf allen Geräten gleich, zwei Darstellungen: „Tage“ (Karten je relevantem Tag mit
  `AvailabilityBar` und nur den Ausnahmen, Planer sehen Gründe) und „Personen“ (Matrix Personen ×
  Tage, leere Zellen = frei). Filter Schauspiel/Gewerke, Namenssuche, „Alle Tage“.
- **Einstellungen** – Dialog (mobil Sheet): Kerntage per Tipp (Kerntag → Ausnahmetag → aus),
  Sperrfrist, Ferien-/Feiertagsquellen mit Prüfen.

Termine pflegen Planer zusätzlich unter **Terminplanung** (`/mitglieder/terminplanung`): Liste
nach Monaten, Filter nach Art, je Termin Verfügbarkeit und wer fehlt (mit Grund).

Tag-Stufen (`src/lib/sperrliste/day-tiers.ts`): `core` = Kerntage (Einstellungen)
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
- `page-client.tsx` – Reiter, Aktionen (Termin, PDF, Abonnieren, Einstellungen), gemeinsamer Monat
- `calendar-feed-dialog.tsx` – Kalender-Abo: Link erzeugen/erneuern/abschalten, eigene Sperren ein/aus
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
- Kalender-Abo: Modell `CalendarFeed` (ein Link pro Person, Token, `includeBlockedDays`,
  `lastAccessedAt`), verwaltet über `src/app/api/calendar/feed/route.ts` (GET/POST/PATCH/DELETE).
  `src/lib/calendar/feed.ts` berechnet den Feed bei jedem Abruf neu: Proben mit Einladung
  (Absagen als `CANCELLED`, keine Entwürfe), `CalendarEvent`s ohne Produktion oder der eigenen
  aktuellen Produktionen, Gewerke-Termine, optional eigene Sperren (ganztägig, `TRANSPARENT`).
  Zeitraum 60 Tage zurück bis ca. 18 Monate voraus; deaktivierte Personen erhalten 404.
  `src/lib/calendar/ics.ts` erzeugt das iCalendar-Format.
- Feiertage werden über `src/lib/holidays.ts` aus externen ICS-Quellen geladen (konfigurierbar,
  mit statischen Fallbacks in `src/data/saxony-*.ts`); der Prüfstatus wird in
  `SperrlisteSettings` persistiert.

## Besonderheiten / Altlasten

- Feiertage werden über eine externe ICS-Quelle geladen.

## Stand 2026-09 (Runde 3)

- „Probentag“ heißt jetzt „Kerntag“ – ein Tag wird erst durch eine angesetzte Probe zum Probentag.
- Mehrfachauswahl: im Tagesdetail „Mehrere Tage auswählen“, dann Tage antippen und Status für alle setzen (Bulk-Route, Sperrfrist wird übersprungen).
- Mobile Blätter (`src/components/ui/bottom-sheet.tsx`) sind auf `90dvh` begrenzt, scrollen innen und lassen sich am Griff nach unten wegwischen.
- Team „Personen“: kompakte Kachelmatrix, die mobil ohne Querscrollen passt.
- Terminplanung zeigt je Termin „Können nicht“, „Eingeschränkt“ (mit Gründen) und „Können“; mehrtägige Termine werten den ungünstigsten Tag.
- Mehrtägige Termine ohne Endzeit laufen bis 23:59 des letzten Tages. Vorher gespeicherte Termine dieser Art einmal neu speichern.
