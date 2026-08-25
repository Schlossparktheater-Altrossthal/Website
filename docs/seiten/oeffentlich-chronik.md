# Chronik (öffentlich)

## Zweck

Darstellung vergangener Produktionen mit Bildern, Daten und Besetzung.

## Routen

- `/chronik` – Übersicht
- `/chronik/[showId]` – Detail einer vergangenen Produktion

## Wichtige Komponenten

- `src/app/(site)/chronik/page.tsx`
- `src/app/(site)/chronik/[showId]/page.tsx`
- `src/app/(site)/chronik/chronik-featured-show-cards.tsx`
- `src/app/(site)/chronik/editable-performance-dates-card.tsx`

## Datenfluss

- Inhalte editierbar (Chronik-Content, `PRIVATE.CHRONIK.MANAGE`).

## Besonderheiten

- Die ehemalige `fullframes.tsx` war toter Code und wurde entfernt.
