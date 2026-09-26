-- Zielgruppen-Regeln und Handänderungen an Teilnehmern (Terminplanung Phase 2).

-- CreateEnum
CREATE TYPE "FeedScope" AS ENUM ('MINE', 'PRODUCTIONS');

-- CreateEnum
CREATE TYPE "AudienceRuleType" AS ENUM ('PRODUCTION_ALL', 'ALL_CAST', 'ALL_CREW', 'DEPARTMENT', 'CHARACTER', 'SCENE', 'USER');

-- CreateEnum
CREATE TYPE "ParticipantOverride" AS ENUM ('INCLUDED', 'EXCLUDED');

-- AlterTable
ALTER TABLE "CalendarFeed" ADD COLUMN     "scope" "FeedScope" NOT NULL DEFAULT 'MINE';

-- AlterTable
ALTER TABLE "EventParticipant" ADD COLUMN     "levelOverride" "ParticipationLevel",
ADD COLUMN     "override" "ParticipantOverride",
ADD COLUMN     "reasons" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "EventAudienceRule" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "AudienceRuleType" NOT NULL,
    "targetId" TEXT,
    "level" "ParticipationLevel" NOT NULL DEFAULT 'REQUIRED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventAudienceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventAudienceRule_eventId_idx" ON "EventAudienceRule"("eventId");

-- AddForeignKey
ALTER TABLE "EventAudienceRule" ADD CONSTRAINT "EventAudienceRule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bisherige Einladungen zu Proben waren eine Handauswahl: als solche übernehmen.
UPDATE "EventParticipant" p
SET "override" = 'INCLUDED', "reasons" = '["Eingeladen"]'::jsonb
FROM "CalendarEvent" e
WHERE e."id" = p."eventId" AND e."kind" = 'REHEARSAL' AND p."invited" = true;
