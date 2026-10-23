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

- `src/app/(members)/mitglieder/website/theme-settings-manager.tsx` – Seite: Titel und
  Standard-Farbmodus, Theme-Galerie, Editor, Dialoge
- `theme-gallery.tsx` (Karten mit Vorschau, „⋯“-Menü: aktivieren, für Mitglieder wählbar,
  duplizieren, exportieren, löschen), `theme-editor.tsx` (wichtigste Farben zuerst, Rest
  aufklappbar, Live-Vorschau `theme-live-preview.tsx` daneben bzw. mobil oben),
  `theme-import-dialog.tsx` (Vorschau vor dem Anlegen)
- `src/components/theme/theme-preview-card.tsx` – Vorschaukarte, auch im Profil „Darstellung“
- `src/app/(members)/mitglieder/pages/seitensteuerung/seitensteuerung-manager.tsx`

## Datenfluss

- Theme-Tokens über `src/lib/website-settings.ts` (`ThemeTokens`, Branded Types wie
  `ThemeModeKey`/`ThemeTokenKey`).
- Sichtbarkeit der Mitglieder-Seiten über `PageVisibilitySettings` (`members`) und
  `saveWebsiteSettings`; gelesen wird sie in `src/components/members-nav.tsx` (Menü).
- Ausgeblendete Seiten sind gesperrt, nicht nur aus dem Menü entfernt: `src/proxy.ts`
  reicht den Pfad als `x-members-pathname` an das Mitglieder-Layout, das ohne
  `PRIVATE.ADMIN.PAGES.MANAGE` auf `/mitglieder` umleitet. Bei Client-Navigation greift
  `HiddenPageGuard`. Unterseiten gehören zum spezifischsten Menüeintrag
  (`src/lib/members-page-visibility.ts`); Dashboard und Seitensteuerung sind nie ausblendbar.
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
- Import: tweakcn-Links aller Art (Vorlagen, Community, eigene Themes, Editor) werden auf
  `https://tweakcn.com/r/themes/<id>` (ohne `.json`) abgebildet; nur diese Adressen ruft der
  Server ab (`src/lib/theme/import.ts`).
- Persönliche Darstellung: `WebsiteTheme.memberSelectable` gibt ein Theme fürs Profil frei,
  `User.colorModePreference`/`themePreferenceId` speichern die Wahl
  (`/api/profile/appearance`); das Root-Layout wendet sie an. Plan:
  `docs/Plan/theme-plan.md`.
- Der Theme-Editor arbeitet mit OKLCH-Werten. Es gibt keinen eigenen Token-Build-Schritt:
  Farben, Radius und Schatten kommen aus `src/lib/theme/` (tweakcn-Format) und werden vom
  `ThemeStyleRegistry` im Root-Layout als CSS-Variablen ausgegeben. Die Doku-Swatches erzeugt
  `pnpm swatches:gen`.
