-- CreateEnum
CREATE TYPE "MilestoneKind" AS ENUM ('milestone', 'deadline', 'handover', 'review');

-- CreateEnum
CREATE TYPE "MilestoneAnchor" AS ENUM ('premiere', 'finalRehearsalStart', 'milestone', 'fixed');

-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "premiereAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ShowMilestone" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "departmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "MilestoneKind" NOT NULL DEFAULT 'milestone',
    "anchorType" "MilestoneAnchor" NOT NULL DEFAULT 'premiere',
    "anchorMilestoneId" TEXT,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "fixedDate" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "calendarEventId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneDependency" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "lagDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MilestoneDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowMilestone_calendarEventId_key" ON "ShowMilestone"("calendarEventId");

-- CreateIndex
CREATE INDEX "ShowMilestone_showId_dueAt_idx" ON "ShowMilestone"("showId", "dueAt");

-- CreateIndex
CREATE INDEX "ShowMilestone_departmentId_idx" ON "ShowMilestone"("departmentId");

-- CreateIndex
CREATE INDEX "MilestoneDependency_toId_idx" ON "MilestoneDependency"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneDependency_fromId_toId_key" ON "MilestoneDependency"("fromId", "toId");

-- AddForeignKey
ALTER TABLE "ShowMilestone" ADD CONSTRAINT "ShowMilestone_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowMilestone" ADD CONSTRAINT "ShowMilestone_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowMilestone" ADD CONSTRAINT "ShowMilestone_anchorMilestoneId_fkey" FOREIGN KEY ("anchorMilestoneId") REFERENCES "ShowMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowMilestone" ADD CONSTRAINT "ShowMilestone_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowMilestone" ADD CONSTRAINT "ShowMilestone_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "ShowMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_toId_fkey" FOREIGN KEY ("toId") REFERENCES "ShowMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Premiere aus Show.dates vorbelegen: erstes Datum ("YYYY-MM-DD" oder "YYYY-MM-DD/YYYY-MM-DD"), UTC-Mitternacht wie beim Speichern.
UPDATE "Show"
SET "premiereAt" = substring("dates" #>> '{}' from '^(\d{4}-\d{2}-\d{2})')::timestamp
WHERE "premiereAt" IS NULL
  AND jsonb_typeof("dates") = 'string'
  AND ("dates" #>> '{}') ~ '^\d{4}-\d{2}-\d{2}';
