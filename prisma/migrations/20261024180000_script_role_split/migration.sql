-- AlterTable
ALTER TABLE "ScriptRole" ADD COLUMN     "splitFromId" TEXT,
ADD COLUMN     "splitSceneKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

