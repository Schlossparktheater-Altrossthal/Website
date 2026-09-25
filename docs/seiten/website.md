# Website & Theme

## Zweck

Branding- und Darstellungseinstellungen des Mitgliederbereichs: Theme (Farben/Tokens)
und Seitensteuerung (Sichtbarkeit der Mitglieder-Seiten).

Der öffentliche Auftritt läuft auf Drupal. Die frühere Steuerung öffentlicher Seiten
(Seiteninhalte-CMS, Homepage-Bausteine, Wartungsmodus) wurde entfernt.

## Routen

- `/mitglieder/website` – Theme & Branding
- `/mitglieder/pages/seitensteuerung` – Seitensteuerung (Sichtbarkeit Mitglieder-Seiten)

## Permissions

- `PRIVATE.SETTINGS.THEME.MANAGE` – Theme/Branding verwalten
- `PRIVATE.ADMIN.PAGES.MANAGE` – Seitensteuerung (Sichtbarkeit Mitglieder-Seiten)

## Wichtige Komponenten

- `src/app/(members)/mitglieder/website/theme-settings-manager.tsx` – Theme-Editor
- `src/app/(members)/mitglieder/pages/seitensteuerung/seitensteuerung-manager.tsx`

## Datenfluss

- Theme-Tokens über `src/lib/website-settings.ts` (`ThemeTokens`, Branded Types wie
  `ThemeModeKey`/`ThemeTokenKey`).
- Sichtbarkeit der Mitglieder-Seiten über `PageVisibilitySettings` (`members`) und
  `saveWebsiteSettings`; gelesen wird sie in `src/components/members-nav.tsx`.
- API: `src/app/api/website/settings/route.ts` (`GET`/`PUT`). Die Schreibrechte sind
  feldbezogen: Seiten-Sichtbarkeit erfordert `PRIVATE.ADMIN.PAGES.MANAGE`, Theme/Branding
  `PRIVATE.SETTINGS.THEME.MANAGE`.
- Drupal-Bridges bleiben bestehen: `/api/website/theme.css` (Theme als CSS) und
  `/api/public/me` (Login-Status).

## Besonderheiten / Altlasten

- Das frühere Seiteninhalte-CMS (`/mitglieder/website/inhalte`, `PUBLIC.CONTENT.MANAGE`) wurde
  entfernt, ebenso der öffentliche Next-Auftritt (`/old/**`), der Wartungsmodus und die
  Sichtbarkeit öffentlicher Seiten. `sitemap.ts` liefert bewusst eine leere Sitemap,
  `robots.ts` setzt `Disallow: /`.
- Branded Types erfordern gelegentlich gezielte Konvertierungen (siehe `theme-settings-manager.tsx`).
- Der Theme-Editor arbeitet mit OKLCH-Parametern; Tokens werden über
  `pnpm design-system:tokens` gebaut.
