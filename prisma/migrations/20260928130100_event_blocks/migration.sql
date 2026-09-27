-- Szenen an Proben werden allgemeine Bausteine eines Termins (Terminplanung Phase 6).
-- Umbenennen statt neu anlegen, damit Zeitplan und Nachbereitung erhalten bleiben.

-- CreateEnum
CREATE TYPE "EventBlockType" AS ENUM ('SCENE', 'DEPARTMENT', 'CUSTOM');

-- RenameTable
ALTER TABLE "EventScene" RENAME TO "EventBlock";
ALTER TABLE "EventBlock" RENAME CONSTRAINT "EventScene_pkey" TO "EventBlock_pkey";
ALTER TABLE "EventBlock" RENAME CONSTRAINT "EventScene_eventId_fkey" TO "EventBlock_eventId_fkey";
ALTER TABLE "EventBlock" RENAME CONSTRAINT "EventScene_sceneId_fkey" TO "EventBlock_sceneId_fkey";
ALTER INDEX "EventScene_sceneId_idx" RENAME TO "EventBlock_sceneId_idx";
ALTER INDEX "EventScene_eventId_sceneId_key" RENAME TO "EventBlock_eventId_sceneId_key";

-- AlterTable
ALTER TABLE "EventBlock" ALTER COLUMN "sceneId" DROP NOT NULL,
ADD COLUMN     "type" "EventBlockType" NOT NULL DEFAULT 'SCENE',
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "location" TEXT;

-- CreateIndex
CREATE INDEX "EventBlock_departmentId_idx" ON "EventBlock"("departmentId");

-- AddForeignKey
ALTER TABLE "EventBlock" ADD CONSTRAINT "EventBlock_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
