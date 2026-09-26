-- Szenen an Proben, gestaffelter Zeitplan und Nachbereitung (Terminplanung Phase 4).

-- CreateEnum
CREATE TYPE "EventScheduleMode" AS ENUM ('TOGETHER', 'STAGGERED');

-- CreateEnum
CREATE TYPE "SceneRehearsalOutcome" AS ENUM ('DONE', 'PARTIAL', 'SKIPPED');

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "scheduleMode" "EventScheduleMode" NOT NULL DEFAULT 'TOGETHER';

-- AlterTable
ALTER TABLE "EventParticipant" ADD COLUMN     "attended" BOOLEAN,
ADD COLUMN     "personalEnd" TIMESTAMP(3),
ADD COLUMN     "personalStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventScene" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "outcome" "SceneRehearsalOutcome",
    "note" TEXT,

    CONSTRAINT "EventScene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventScene_sceneId_idx" ON "EventScene"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "EventScene_eventId_sceneId_key" ON "EventScene"("eventId", "sceneId");

-- AddForeignKey
ALTER TABLE "EventScene" ADD CONSTRAINT "EventScene_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventScene" ADD CONSTRAINT "EventScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bereits gewählte Szenen-Regeln als Szenen der Probe übernehmen.
INSERT INTO "EventScene" ("id", "eventId", "sceneId", "order")
SELECT 'es_' || md5(r."eventId" || ':' || r."targetId"), r."eventId", r."targetId", r."sortOrder"
FROM "EventAudienceRule" r
JOIN "Scene" s ON s."id" = r."targetId"
WHERE r."type" = 'SCENE'
ON CONFLICT ("eventId", "sceneId") DO NOTHING;
