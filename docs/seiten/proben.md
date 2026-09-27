# Proben

## Zweck

Planung, Anlage und Verwaltung von Proben. Ensemblemitglieder sehen ihre eigenen Termine,
Probenplaner verwalten den Gesamtplan.

## Routen

- `/mitglieder/terminplanung` – Gesamtplanung für Proben und Termine (Kalender mit Tagesblatt, Liste, Entwürfe, Szenen-Stand); `/mitglieder/probenplanung` leitet auf `?art=proben` um
- `/mitglieder/terminplanung` – organisationsweite Termine (für Planer; Liste nach Monaten)
- `/mitglieder/terminplanung/[eventId]` – gemeinsamer Editor für Proben und Termine (alte Adresse `/mitglieder/probenplanung/proben/[id]` leitet um)
- `/mitglieder/proben/[rehearsalId]` – Detailansicht einer Probe
- `/mitglieder/meine-proben` – eigene Termine: Liste oder Kalender, Suche, Absagen (siehe [meine-termine.md](meine-termine.md))

## Permissions

- `PRIVATE.REHEARSAL.PLANNING.MANAGE` – Planung/Bearbeitung
- `PRIVATE.REHEARSAL.OWN.VIEW` – eigene Proben
- `PRIVATE.REHEARSAL.BLOCKLIST.VIEW` – Blocker-Übersicht

## Wichtige Komponenten

- `src/app/(members)/mitglieder/terminplanung/` – Planungsseite (`page-client.tsx`), Editor (`event-editor.tsx`), Anlegen (`new-event.tsx`)
- `src/app/(members)/mitglieder/terminplanung/actions/` – Server Actions

## Datenfluss

- Prisma-Modelle: `CalendarEvent` (`kind = REHEARSAL`), `EventParticipant`, `EventResponseLog`
- Server Actions in `terminplanung/actions/` bündeln die Mutationslogik.

## Realtime

- Probentermine werden über `useRealtime` live aktualisiert (z. B. `rehearsal_updated`).

## Besonderheiten / Altlasten

- `probenplanung/actions.ts` ist sehr groß (700+ Zeilen) – aufgeteilt in Aufgabe „Actions-Dateien
  aufteilen" (P5).
- Die Gesamtplanung bietet zwei Ansichten (Kalenderansicht / Wochenend-Fokus) über ein
  `SegmentedControl` (`src/components/ui/segmented-control.tsx`).
- Zeitlogik läuft über `DEFAULT_TIME_ZONE` aus `src/lib/date-time.ts`.

## Terminfinder (`/mitglieder/terminplanung/terminfinder`)

Recht: `PRIVATE.REHEARSAL.PLANNING.MANAGE` (Produktion). Zielgruppe mit dem Baukasten wählen, Zeitraum, Wochentage und Uhrzeit angeben; „Termine finden“ bewertet jeden Tag nach Sperrliste und anderen angesetzten Terminen im Zeitfenster (benötigte Personen zählen mehr als optionale). Ergebnis als Heatmap aller Tage und Liste der besten Tage; „Probe anlegen“ erstellt einen Entwurf mit Datum, Uhrzeit und Zielgruppe. Erreichbar über „Termin finden“ in der Probenplanung.
