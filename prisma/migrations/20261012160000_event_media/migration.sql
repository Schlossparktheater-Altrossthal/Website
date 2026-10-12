-- Medien zu Terminen (Fotos, Sprachmemos, Musik); Bytes im Objektspeicher.

-- CreateEnum
CREATE TYPE "EventMediaKind" AS ENUM ('IMAGE', 'AUDIO', 'FILE');

-- CreateTable
CREATE TABLE "EventMedia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "blockId" TEXT,
    "noteId" TEXT,
    "kind" "EventMediaKind" NOT NULL,
    "gallery" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "durationSec" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "bucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "thumbKey" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventMedia_eventId_createdAt_idx" ON "EventMedia"("eventId", "createdAt");
CREATE INDEX "EventMedia_blockId_idx" ON "EventMedia"("blockId");
CREATE INDEX "EventMedia_noteId_idx" ON "EventMedia"("noteId");

-- AddForeignKey
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "EventBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "EventNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
