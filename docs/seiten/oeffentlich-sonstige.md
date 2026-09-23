# Galerie, Datenschutz & Impressum (öffentlich)

## Zweck

Statische bzw. bildbasierte Seiten und rechtliche Pflichtseiten.

## Routen

- `/galerie` – Bildergalerie
- `/datenschutz` – Datenschutzerklärung
- `/impressum` – Impressum

## Wichtige Komponenten

- `src/app/old/galerie/page.tsx`
- `src/app/old/datenschutz/page.tsx`
- `src/app/old/impressum/page.tsx`

## Datenfluss

- Galerie liest Bilder aus dem Dateisystem (analog zur Schulkatze).
- Datenschutz/Impressum sind überwiegend statische Inhalte.

## Besonderheiten

- Diese Seiten sind Teil der Sichtbarkeitssteuerung (`PageVisibilitySettings`).
