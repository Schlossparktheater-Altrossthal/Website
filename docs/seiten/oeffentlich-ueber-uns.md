# Über uns (öffentlich)

## Zweck

Vorstellung des Sommertheaters Altrossthal (Verein, Menschen, Geschichte).

## Routen

- `/ueber-uns`

## Wichtige Komponenten

- `src/app/old/ueber-uns/page.tsx`

## Datenfluss

- Inhalte liegen statisch in `src/lib/website-content.ts` (`UEBER_UNS_*`).

## Besonderheiten

- Die Kennzahlen werden zur Laufzeit mit `getCurrentProductionEnsembleStats`
  (Mitgliederzahl der aktuellen Produktion) angereichert.
