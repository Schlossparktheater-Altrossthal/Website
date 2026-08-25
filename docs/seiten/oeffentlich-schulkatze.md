# Schulkatze (öffentlich)

## Zweck

Erinnerungsseite an die Schulkatze Dieter des BSZ Altrossthal – Geschichte, Begegnungen,
Galerie.

## Routen

- `/unsere-schulkatze`

## Wichtige Komponenten

- `src/app/(site)/unsere-schulkatze/page.tsx`
- `src/app/(site)/unsere-schulkatze/encounters-section.tsx`
- `src/app/(site)/unsere-schulkatze/schulkatze-gallery.tsx`
- `src/app/(site)/unsere-schulkatze/image-rotator.tsx`

## Datenfluss

- Bilder werden aus `public/images/katze` gelesen (`resolveCatImages`).
- Intro-Inhalte über `src/lib/website-content.ts` (`readSchulkatzeIntro`).

## Besonderheiten / Altlasten

- Beim Aufräumen (P3) wurden mehrere unbenutzte Icons/Typen entfernt (`CatIcon`,
  `catCareLessons`, …).
