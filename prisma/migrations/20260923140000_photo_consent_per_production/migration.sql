-- Fotoerlaubnis pro Produktion. Bestehende Erlaubnisse gehören zur bisher einzigen
-- Produktion ("Die unendliche Geschichte"); gibt es mehrere, zur aktiven bzw. jüngsten.
ALTER TABLE "PhotoConsent"
ADD COLUMN "showId" TEXT,
ADD COLUMN "revokedAt" TIMESTAMP(3);

UPDATE "PhotoConsent"
SET "showId" = (
  SELECT "id" FROM "Show"
  ORDER BY ("status" = 'active') DESC, "year" DESC, "id" DESC
  LIMIT 1
)
WHERE "showId" IS NULL;

-- Ohne jede Produktion lassen sich Erlaubnisse keiner Produktion zuordnen.
DELETE FROM "PhotoConsent" WHERE "showId" IS NULL;

ALTER TABLE "PhotoConsent" ALTER COLUMN "showId" SET NOT NULL;

-- DropIndex
DROP INDEX "PhotoConsent_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "PhotoConsent_userId_showId_key" ON "PhotoConsent"("userId", "showId");
CREATE INDEX "PhotoConsent_showId_status_idx" ON "PhotoConsent"("showId", "status");

-- AddForeignKey
ALTER TABLE "PhotoConsent" ADD CONSTRAINT "PhotoConsent_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
