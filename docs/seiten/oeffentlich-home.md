# Home (öffentlich)

## Zweck

Startseite der öffentlichen Website mit Hero-Bereich und Premieren-Countdown.

## Routen

- `/` (Root, `src/app/(site)/page.tsx`)

## Wichtige Komponenten

- `src/components/hero.tsx`, `src/components/hero-rotator.tsx`
- `src/components/countdown.tsx`
- `src/app/(site)/_components/premiere-countdown-section.tsx`

## Datenfluss

- Premieren-Countdown-Einstellungen über `src/lib/premiere-countdown-settings.ts`.

## Realtime / Besonderheiten

- Sichtbarkeit des Countdowns über die Website-Settings.
- Inhalte sind über das Frontend-Editing editierbar (Feature-Keys in
  `src/lib/frontend-editing.ts`).
