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

- Prisma-Modell: `LimitedBlockedDay` (Arten: normal/limited).
- Feiertagsquelle wird über `src/lib/holidays.ts` bezogen (konfigurierbar).

## Besonderheiten / Altlasten

- Nutzt eine dokumentierte **CSS-Override-Strategie** (`sperrliste-styles.css`), da dieser
  Bereich Legacy-Code mit harten Farben enthält (in `AGENTS.md` als Ausnahme erlaubt).
- Die ehemaligen Timeline-Komponenten (`desktop-timeline.tsx`, `mobile-timeline.tsx`,
  `timeline-legend.ts`) waren toter Code und wurden entfernt.
- Feiertage werden über eine externe ICS-Quelle geladen.
