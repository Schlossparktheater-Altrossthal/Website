-- Doppelt gespeicherte Abfragen (gleiche Karte, gleicher Zeitpunkt) entfernen.
DELETE FROM "ScriptLearnReview" a
USING "ScriptLearnReview" b
WHERE a."cardId" = b."cardId" AND a."reviewedAt" = b."reviewedAt" AND a."id" > b."id";

-- DropIndex
DROP INDEX "ScriptLearnReview_cardId_reviewedAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ScriptLearnReview_cardId_reviewedAt_key" ON "ScriptLearnReview"("cardId", "reviewedAt");
