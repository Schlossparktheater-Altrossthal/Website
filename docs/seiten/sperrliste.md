# Sperrliste

## Zweck

Erfassung der Nicht-Verfügbarkeiten („Sperrzeiten") der Ensemblemitglieder, damit die
Probenplanung freie Zeiten kennt.

## Routen

- `/mitglieder/sperrliste`

## Permissions

- `PRIVATE.REHEARSAL.BLOCKLIST.VIEW` – Ansicht
- `PRIVATE.REHEARSAL.BLOCKLIST.SETTINGS` – Einstellungen
- `PRIVATE.REHEARSAL.BLOCKLIST.EXPORT` – Export

## Wichtige Komponenten

- `src/app/(members)/mitglieder/sperrliste/page.tsx` – Hauptseite
- `src/app/(members)/mitglieder/sperrliste/block-calendar.tsx` – Blockerkalender
- `src/app/(members)/mitglieder/sperrliste/settings-manager.tsx` – Einstellungen

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
- Feiertage werden über `src/lib/holidays.ts` aus externen ICS-Quellen geladen (konfigurierbar,
  mit statischen Fallbacks in `src/data/saxony-*.ts`); der Prüfstatus wird in
  `SperrlisteSettings` persistiert.

## Besonderheiten / Altlasten

- Nutzt eine dokumentierte **CSS-Override-Strategie** (`sperrliste-styles.css`), da dieser
  Bereich Legacy-Code mit harten Farben enthält (in `AGENTS.md` als Ausnahme erlaubt).
- Die ehemaligen Timeline-Komponenten (`desktop-timeline.tsx`, `mobile-timeline.tsx`,
  `timeline-legend.ts`) waren toter Code und wurden entfernt.
- Feiertage werden über eine externe ICS-Quelle geladen.
