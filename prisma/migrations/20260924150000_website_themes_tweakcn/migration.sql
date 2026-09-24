-- Website-Themes ins tweakcn-Format überführen (docs/tweakcn-theming-plan.md, Phase C).
-- Alte Themes speichern neben Farbfamilien/Ableitungsregeln die fertig berechneten Werte in
-- "modes". Diese werden 1:1 übernommen; geprüft gegen den Prod-Stand vom 2026-09-24
-- (alle 9 Themes identisch zur bisherigen Ableitung). Fehlende Variablen ergänzt die App.
UPDATE "WebsiteTheme"
SET "tokens" = jsonb_build_object(
  'format', 'tweakcn',
  'theme', CASE
    WHEN jsonb_typeof("tokens" -> 'radius' -> 'base') = 'string'
      THEN jsonb_build_object('radius', "tokens" -> 'radius' -> 'base')
    ELSE '{}'::jsonb
  END,
  'light', COALESCE("tokens" -> 'modes' -> 'light', '{}'::jsonb),
  'dark', COALESCE("tokens" -> 'modes' -> 'dark', '{}'::jsonb)
)
WHERE NOT ("tokens" ? 'format')
  AND jsonb_typeof("tokens" -> 'modes') = 'object';
