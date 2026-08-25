# Mystery (öffentlich)

## Zweck

Öffentliches Rätsel/Spiel rund um das Theater mit Einreichung und Scoreboard.

## Routen

- `/mystery`

## Wichtige Komponenten

- `src/app/(site)/mystery/page.tsx`
- `src/app/(site)/mystery/_components/mystery-guess-board.tsx`
- `src/app/(site)/mystery/_components/mystery-scoreboard.tsx`
- `src/app/(site)/mystery/_components/mystery-launch-countdown-card.tsx`

## Datenfluss

- Einreichungen über `src/lib/mystery-submissions.ts`.
- Countdown über `src/lib/mystery-countdown-settings.ts`.

## Besonderheiten

- Das interne Pendant (Sichtung der Tipps) ist der Mitgliederbereich „Mystery-Tipps".
