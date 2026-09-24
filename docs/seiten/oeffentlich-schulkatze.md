# Schulkatze (öffentlich)

## Zweck

Erinnerungsseite an die Schulkatze Dieter des BSZ Altrossthal – Geschichte, Begegnungen,
Galerie.

## Routen

- `/unsere-schulkatze`

## Wichtige Komponenten

- `src/app/old/unsere-schulkatze/page.tsx`
- `src/app/old/unsere-schulkatze/encounters-section.tsx`
- `src/app/old/unsere-schulkatze/schulkatze-gallery.tsx`
- `src/app/old/unsere-schulkatze/image-rotator.tsx`

## Datenfluss

- Bilder werden aus `public/images/katze` gelesen (`resolveCatImages`).
- Intro-Inhalte liegen statisch in `src/lib/website-content.ts` (`SCHULKATZE_INTRO`).

## Besonderheiten / Altlasten

- Beim Aufräumen (P3) wurden mehrere unbenutzte Icons/Typen entfernt (`CatIcon`,
  `catCareLessons`, …).
