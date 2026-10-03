-- Gespeichertes Standard-Theme: Im Dunkelmodus hatten Karte, Rand und Eingabefeld dieselbe
-- Helligkeit (0.28), Ränder auf Karten waren damit unsichtbar. Ränder heller, gedämpfte
-- Flächen (Wochenende, Reiterleisten) eine Stufe über der Karte.
UPDATE "WebsiteTheme"
SET "tokens" = jsonb_set(jsonb_set(jsonb_set(jsonb_set("tokens"::jsonb,
      '{dark,border}', '"oklch(0.37 0.024 255)"'),
      '{dark,input}', '"oklch(0.37 0.024 255)"'),
      '{dark,muted}', '"oklch(0.325 0.024 255)"'),
      '{dark,sidebar-border}', '"oklch(0.3 0.022 255)"'),
    "updatedAt" = NOW()
WHERE "tokens"::jsonb #>> '{dark,card}' = 'oklch(0.28 0.02 255)'
  AND "tokens"::jsonb #>> '{dark,border}' = 'oklch(0.28 0.024 255)';
