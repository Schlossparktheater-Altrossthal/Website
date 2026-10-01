-- Termine ohne Produktion ab dem 01.10.2026 gehören zur Produktion 2027, damit Szenen und
-- Gewerke im Ablauf verfügbar sind. Gewerk-eigene Termine hängen schon am Gewerk.
UPDATE "CalendarEvent"
SET "showId" = (SELECT "id" FROM "Show" WHERE "year" = 2027 ORDER BY "id" LIMIT 1),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "showId" IS NULL
  AND "departmentId" IS NULL
  AND "start" >= TIMESTAMP '2026-09-30 22:00:00'
  AND EXISTS (SELECT 1 FROM "Show" WHERE "year" = 2027);
