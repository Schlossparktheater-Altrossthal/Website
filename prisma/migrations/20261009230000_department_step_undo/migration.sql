-- CreateEnum
CREATE TYPE "StepUndoScope" AS ENUM ('all', 'own');

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "stepUndo" "StepUndoScope" NOT NULL DEFAULT 'all';
