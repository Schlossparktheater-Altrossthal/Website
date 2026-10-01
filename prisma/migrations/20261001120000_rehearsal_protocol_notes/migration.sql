-- Probenprotokoll: Notizen, Entscheidungen und Aufgaben; Zusammenfassung und Versand.
-- CreateEnum
CREATE TYPE "EventNoteType" AS ENUM ('NOTE', 'DECISION', 'TASK');
-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "protocolSentAt" TIMESTAMP(3),
ADD COLUMN     "protocolSummary" TEXT;
-- CreateTable
CREATE TABLE "EventNote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "blockId" TEXT,
    "type" "EventNoteType" NOT NULL DEFAULT 'NOTE',
    "text" TEXT NOT NULL,
    "authorId" TEXT,
    "assigneeUserId" TEXT,
    "characterId" TEXT,
    "departmentId" TEXT,
    "departmentTaskId" TEXT,
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventNote_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "EventNote_departmentTaskId_key" ON "EventNote"("departmentTaskId");
-- CreateIndex
CREATE INDEX "EventNote_eventId_createdAt_idx" ON "EventNote"("eventId", "createdAt");
-- CreateIndex
CREATE INDEX "EventNote_assigneeUserId_doneAt_idx" ON "EventNote"("assigneeUserId", "doneAt");
-- CreateIndex
CREATE INDEX "EventNote_characterId_doneAt_idx" ON "EventNote"("characterId", "doneAt");
-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "EventBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_departmentTaskId_fkey" FOREIGN KEY ("departmentTaskId") REFERENCES "DepartmentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
