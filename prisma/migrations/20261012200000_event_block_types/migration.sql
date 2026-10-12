-- Weitere Bausteintypen im Ablauf: Durchlauf, Musiknummer, Pause.

-- AlterEnum
ALTER TYPE "EventBlockType" ADD VALUE 'RUN';
ALTER TYPE "EventBlockType" ADD VALUE 'MUSIC';
ALTER TYPE "EventBlockType" ADD VALUE 'BREAK';

-- CreateTable
CREATE TABLE "EventBlockScene" (
    "blockId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,

    CONSTRAINT "EventBlockScene_pkey" PRIMARY KEY ("blockId","sceneId")
);

-- CreateIndex
CREATE INDEX "EventBlockScene_sceneId_idx" ON "EventBlockScene"("sceneId");

-- AddForeignKey
ALTER TABLE "EventBlockScene" ADD CONSTRAINT "EventBlockScene_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "EventBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventBlockScene" ADD CONSTRAINT "EventBlockScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
