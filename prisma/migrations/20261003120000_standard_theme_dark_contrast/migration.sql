-- Standard-Theme: Dunkelmodus mit sichtbaren Rändern und Flächenstufen.
-- Nur anpassen, solange die alten Werte noch unverändert gespeichert sind.
UPDATE "WebsiteTheme"
SET "tokens" = jsonb_set(jsonb_set(jsonb_set(jsonb_set("tokens"::jsonb,
      '{dark,muted}', '"oklch(0.235 0.02 255)"'),
      '{dark,border}', '"oklch(0.31 0.022 255)"'),
      '{dark,input}', '"oklch(0.3 0.02 255)"'),
      '{dark,sidebar-border}', '"oklch(0.27 0.02 255)"'),
    "updatedAt" = NOW()
WHERE "tokens"::jsonb #>> '{dark,border}' = 'oklch(0.24 0.022 255)'
  AND "tokens"::jsonb #>> '{dark,muted}' = 'oklch(0.15 0.02 255)';
