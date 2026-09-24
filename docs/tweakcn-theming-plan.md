# Theming auf tweakcn umstellen

Ziel: Website/Mitgliederbereich und das Drupal-Theme `Theme-Drupal-Sommertheater` nutzen **dasselbe**
Theme im tweakcn-/shadcn-Format. Themes lassen sich aus tweakcn.com übernehmen (CSS einfügen oder
Registry-URL `https://tweakcn.com/r/themes/<name>.json`) und wieder exportieren.

## Entscheidungen

- **T1 Format:** Ein Theme ist `{ format: "tweakcn", theme, light, dark }` mit flachen
  CSS-Variablen (ohne `--`). Das entspricht `cssVars` aus der tweakcn-Registry. `theme` enthält
  modusunabhängige Werte (Schriften, Radius, Tracking), `light`/`dark` die Farben und Schatten.
- **T2 Zusatzvariablen:** `success`, `warning`, `info` (+ `-foreground`) gibt es bei tweakcn nicht.
  Sie bleiben als eigene Variablen erhalten und werden ergänzt, wenn ein Import sie nicht mitbringt.
  Ebenso werden fehlende shadcn-Variablen (`popover`, `sidebar-*`, `chart-*`, Schatten, Schriften)
  aus vorhandenen Werten abgeleitet, damit unvollständige Themes (z. B. Drupal-`theme.css`) nutzbar
  sind.
- **T3 Ableitungsregeln entfallen:** Farbfamilien und OKLCH-Regeln werden nicht mehr gepflegt.
  Bearbeitet werden die fertigen Werte bzw. das Theme wird in tweakcn gebaut und importiert.
- **T4 Keine Schemaänderung:** `WebsiteTheme.tokens` (Json) bleibt. Alte Themes werden beim Lesen
  umgerechnet (gleiches CSS wie vorher), gespeichert wird nur noch das neue Format.
- **T5 Schriften:** Werden selbst gehostet (npm-Pakete, keine Anfragen an Google). Unterstützt sind
  die Schriften des Drupal-Themes (Outfit, Playfair Display, Fira Mono, Inter) plus Geist. Andere
  Schriftnamen fallen auf die System-Schrift zurück.
- **T6 Gemeinsames Theme:** Der Mitgliederbereich liefert das aktive Theme öffentlich als CSS aus
  (`/api/website/theme.css`). Das Drupal-Theme lädt es nach seiner eingebauten `theme.css`, sodass
  bei Ausfall die eingebauten Werte greifen.

## Schritte

- [x] 1. `src/lib/theme/tweakcn.ts`: Parser (CSS + Registry-JSON), Sanitizing, Ergänzen fehlender
      Variablen, CSS-Ausgabe, Umrechnung alter Themes. Tests.
- [x] 2. Speicherung/API auf neues Format: `sanitiseThemeTokens`, Presets, Theme-API, Import-Route
      (tweakcn-URL serverseitig laden, nur `tweakcn.com`). Tests.
- [x] 3. `globals.css`/Layout: Schriften, Schatten, Tracking aus dem Theme. Schriften-Pakete.
- [x] 4. Editor neu: Import/Export, Farbwähler pro Variable (Light/Dark), Vorschau.
- [x] 5a. Drupal-Theme als Preset „Sommertheater (Drupal)“ (`src/lib/theme/presets`).
- [x] 5b. Öffentlicher CSS-Endpunkt `/api/website/theme.css`.
- [ ] 6. _Zurückgestellt (2026-09-24):_ Vorerst werden Drupal- und Mitgliederbereich-Theme getrennt
      gepflegt, Austausch per Export/Import. Später: Drupal-Theme lädt den Endpunkt.
- [ ] C. Aufräumen nach Staging-Test: Migration schreibt alle Themes ins neue Format, alter
      Ableitungscode, `tokens.json`-Parameter und `build-design-tokens.mjs` entfallen.
