# Sprint 2 – Design-System & Tokens erweitern

Dieser Sprint erweitert die in Sprint 1 angelegte Layoutbasis um konsistente Farb-, Typografie- und Komponententokens.

## 1. Farb- & Token-Update
- `src/design-system/tokens.json` ergänzt um `success`, `warning`, `info` sowie `*-foreground`-Werte für konsistente Kontraste.
- Dunkle & helle Modi mit abgestimmter Primärpalette (Violett), Sekundärton (Bernstein) und Akzent (Türkis).
- `pnpm design-system:tokens` regeneriert `src/app/design-tokens.css`; Tailwind erhält neue Paletten (`success`, `warning`, `info`).
- `docs/swatches/palette.sample.json` + `pnpm swatches:gen` erzeugen aktualisierte Swatches (`primary-500`, `accent-200`, ...).

## 2. Typografie & Spacing
- In `src/app/globals.css` neue Custom Properties (`--font-size-*`, `--line-height-*`, `--space-*`) für ein 8pt-System.
- Utility-Layer `.text-display`, `.text-h1` … `.text-eyebrow` für skalierte Headlines und Fließtext.
- `Heading` & `Text` Komponenten (`@/components/ui/typography`) kapseln Level, Tone (`tone`), Alignment & Weight.

## 3. Komponentenvarianten
- `Button`: neue Varianten (`primary`, `accent`, `ghost`, `subtle`, `link`, `success`, `info`) & Größen (`xs`–`xl`, `icon`), einheitliche Fokus-/Hover-States.
- `Badge`: pill-förmige Varianten mit soft Tints (`muted`, `accent`, `success`, `warning`, `info`, `ghost`, `outline`).
- `TextLink`: dedizierte Link-Komponente mit Varianten (`default`, `subtle`, `muted`, `ghost`, `accent`, `button`) und `disabled`-Handling.

## 4. Anwendung im Marketing-Auftritt
- Hero-Headline, Einleitung & CTA-Chips nutzen neue `Heading`-, `Text`- und `Badge`-Komponenten.
- FAQ-Sektion (`src/app/page.tsx`) nutzt `Badge`, `Heading`, `Text`, `TextLink` und profitiert von der aktualisierten Farbpalette.

## Erfolgskriterien
- Alle Komponenten greifen auf gemeinsame Tokens zurück; Kontraste ≥ 4.5:1 (Primär, Sekundär, Akzent).
- Typografie skaliert responsiv über Utility-Klassen und UI-Komponenten.
- Redesign-Dokumentation (`docs/design-system.md`) spiegelt aktuelle Tokens, Spacing, Komponentenvarianten.
