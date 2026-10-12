-- Aufgaben aus dem Probenprotokoll an mehrere Zuständige; Einträge bearbeitbar.

-- CreateTable
CREATE TABLE "EventNoteAssignee" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT,
    "characterId" TEXT,
    "departmentId" TEXT,
    "departmentTaskId" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,

    CONSTRAINT "EventNoteAssignee_pkey" PRIMARY KEY ("id")
);

-- Bestehende Einzel-Zuständigkeiten übernehmen (Erledigt-Stand inklusive).
INSERT INTO "EventNoteAssignee" ("id", "noteId", "userId", "characterId", "departmentId", "departmentTaskId", "doneAt")
SELECT 'ena_' || "id", "id", "assigneeUserId", "characterId", "departmentId", "departmentTaskId", "doneAt"
FROM "EventNote"
WHERE "assigneeUserId" IS NOT NULL OR "characterId" IS NOT NULL OR "departmentId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "EventNote" DROP CONSTRAINT "EventNote_assigneeUserId_fkey";
ALTER TABLE "EventNote" DROP CONSTRAINT "EventNote_characterId_fkey";
ALTER TABLE "EventNote" DROP CONSTRAINT "EventNote_departmentId_fkey";
ALTER TABLE "EventNote" DROP CONSTRAINT "EventNote_departmentTaskId_fkey";

-- DropIndex
DROP INDEX "EventNote_assigneeUserId_doneAt_idx";
DROP INDEX "EventNote_characterId_doneAt_idx";
DROP INDEX "EventNote_departmentTaskId_key";

-- AlterTable
ALTER TABLE "EventNote" DROP COLUMN "assigneeUserId",
DROP COLUMN "characterId",
DROP COLUMN "departmentId",
DROP COLUMN "departmentTaskId",
ADD COLUMN "editedAt" TIMESTAMP(3),
ADD COLUMN "editedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EventNoteAssignee_departmentTaskId_key" ON "EventNoteAssignee"("departmentTaskId");
CREATE INDEX "EventNoteAssignee_noteId_idx" ON "EventNoteAssignee"("noteId");
CREATE INDEX "EventNoteAssignee_userId_doneAt_idx" ON "EventNoteAssignee"("userId", "doneAt");
CREATE INDEX "EventNoteAssignee_characterId_doneAt_idx" ON "EventNoteAssignee"("characterId", "doneAt");
CREATE INDEX "EventNoteAssignee_departmentId_idx" ON "EventNoteAssignee"("departmentId");

-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventNoteAssignee" ADD CONSTRAINT "EventNoteAssignee_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "EventNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventNoteAssignee" ADD CONSTRAINT "EventNoteAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventNoteAssignee" ADD CONSTRAINT "EventNoteAssignee_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventNoteAssignee" ADD CONSTRAINT "EventNoteAssignee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventNoteAssignee" ADD CONSTRAINT "EventNoteAssignee_departmentTaskId_fkey" FOREIGN KEY ("departmentTaskId") REFERENCES "DepartmentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventNoteAssignee" ADD CONSTRAINT "EventNoteAssignee_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
