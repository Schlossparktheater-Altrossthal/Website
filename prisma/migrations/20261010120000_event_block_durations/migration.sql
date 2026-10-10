-- Ablauf mit Dauern: geplante Länge, angeheftete Uhrzeit, Spur, „für alle“.
ALTER TABLE "EventBlock" ADD COLUMN "durationMinutes" INTEGER;
ALTER TABLE "EventBlock" ADD COLUMN "fixedStart" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventBlock" ADD COLUMN "track" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EventBlock" ADD COLUMN "forEveryone" BOOLEAN NOT NULL DEFAULT false;

-- Bestehende Zeiten bleiben, wie sie sind: Dauer aus Start/Ende, Uhrzeit angeheftet.
UPDATE "EventBlock"
SET "durationMinutes" = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 60))::INTEGER,
    "fixedStart" = true
WHERE "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL;
