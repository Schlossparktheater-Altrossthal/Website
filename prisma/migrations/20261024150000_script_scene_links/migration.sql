-- CreateEnum
CREATE TYPE "SceneCharacterSource" AS ENUM ('manual', 'script');
-- AlterTable
ALTER TABLE "SceneCharacter" ADD COLUMN     "source" "SceneCharacterSource" NOT NULL DEFAULT 'manual';
-- CreateTable
CREATE TABLE "ScriptSceneLink" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "sceneKey" TEXT NOT NULL,
    "sceneId" TEXT,
    "synced" JSONB,
    "syncedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptSceneLink_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ScriptSceneLink_sceneId_idx" ON "ScriptSceneLink"("sceneId");
-- CreateIndex
CREATE UNIQUE INDEX "ScriptSceneLink_showId_sceneKey_key" ON "ScriptSceneLink"("showId", "sceneKey");
-- AddForeignKey
ALTER TABLE "ScriptSceneLink" ADD CONSTRAINT "ScriptSceneLink_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ScriptSceneLink" ADD CONSTRAINT "ScriptSceneLink_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
