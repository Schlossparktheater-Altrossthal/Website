-- Der Wartungsmodus wurde nie erzwungen (kein middleware/Layout liest ihn) und der
-- öffentliche Auftritt läuft auf Drupal – das Feld entfällt.
ALTER TABLE "WebsiteSettings" DROP COLUMN IF EXISTS "maintenanceMode";

-- Altbestände der öffentlichen Seiten-Sichtbarkeit aus dem JSON entfernen. Erhalten
-- bleibt ausschließlich die Sichtbarkeit der Mitglieder-Seiten.
UPDATE "WebsiteSettings"
SET "pageVisibility" = jsonb_build_object(
  'members',
  COALESCE("pageVisibility" -> 'members', '{}'::jsonb)
)
WHERE "pageVisibility" IS NOT NULL;
