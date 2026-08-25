# Website & Inhalte

## Zweck

Branding- und Darstellungseinstellungen der öffentlichen Website: Theme (Farben/Tokens),
Inhalte und Seitensteuerung (Sichtbarkeit von Seiten).

## Routen

- `/mitglieder/website` – Theme & Branding
- `/mitglieder/website/inhalte` – Inhalte
- `/mitglieder/pages/seitensteuerung` – Seitensteuerung
- `/mitglieder/pages/ui` – UI-Steuerung

## Permissions

- `PRIVATE.SETTINGS.THEME.MANAGE` – Theme verwalten
- `PRIVATE.ADMIN.PAGES.MANAGE` – Seitensteuerung
- `PRIVATE.CHRONIK.MANAGE` – Chronik-Inhalte

## Wichtige Komponenten

- `src/app/(members)/mitglieder/website/theme-settings-manager.tsx` – Theme-Editor
- `src/app/(members)/mitglieder/pages/seitensteuerung/seitensteuerung-manager.tsx`

## Datenfluss

- Theme-Tokens über `src/lib/website-settings.ts` (`ThemeTokens`, Branded Types wie
  `ThemeModeKey`/`ThemeTokenKey`).
- Sichtbarkeit über `PageVisibilitySettings` und `saveWebsiteSettings`.

## Besonderheiten / Altlasten

- Branded Types erfordern gelegentlich gezielte Konvertierungen (siehe `theme-settings-manager.tsx`).
- Der Theme-Editor arbeitet mit OKLCH-Parametern; Tokens werden über
  `pnpm design-system:tokens` gebaut.
