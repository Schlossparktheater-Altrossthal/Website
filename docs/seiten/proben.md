# Proben

## Zweck

Planung, Anlage und Verwaltung von Proben. Ensemblemitglieder sehen ihre eigenen Termine,
Probenplaner verwalten den Gesamtplan.

## Routen

- `/mitglieder/probenplanung` – Gesamtplanung
- `/mitglieder/probenplanung/proben/[rehearsalId]` – Probe bearbeiten
- `/mitglieder/proben/[rehearsalId]` – Detailansicht einer Probe
- `/mitglieder/meine-proben` – eigene Probentermine

## Permissions

- `PRIVATE.REHEARSAL.PLANNING.MANAGE` – Planung/Bearbeitung
- `PRIVATE.REHEARSAL.OWN.VIEW` – eigene Proben
- `PRIVATE.REHEARSAL.BLOCKLIST.VIEW` – Blocker-Übersicht

## Wichtige Komponenten

- `src/app/(members)/mitglieder/probenplanung/` – Planungsseiten
- `src/app/(members)/mitglieder/probenplanung/rehearsal-editor.tsx` – Probeneditor
- `src/app/(members)/mitglieder/probenplanung/actions.ts` – Server Actions

## Datenfluss

- Prisma-Modelle: `Rehearsal`, `RehearsalInvitee`
- Server Actions in `probenplanung/actions.ts` bündeln die Mutationslogik.

## Realtime

- Probentermine werden über `useRealtime` live aktualisiert (z. B. `rehearsal_updated`).

## Besonderheiten / Altlasten

- `probenplanung/actions.ts` ist sehr groß (700+ Zeilen) – aufgeteilt in Aufgabe „Actions-Dateien
  aufteilen" (P5).
- Zeitlogik läuft über `DEFAULT_TIME_ZONE` aus `src/lib/date-time.ts`.
