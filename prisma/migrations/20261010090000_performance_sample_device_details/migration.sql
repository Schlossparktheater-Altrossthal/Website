-- AlterTable
ALTER TABLE "analytics_performance_samples"
  ADD COLUMN "viewportWidth" INTEGER,
  ADD COLUMN "viewportHeight" INTEGER,
  ADD COLUMN "screenWidth" INTEGER,
  ADD COLUMN "screenHeight" INTEGER,
  ADD COLUMN "pixelRatio" DOUBLE PRECISION,
  ADD COLUMN "orientation" TEXT,
  ADD COLUMN "touch" BOOLEAN,
  ADD COLUMN "buildId" TEXT,
  ADD COLUMN "interactionType" TEXT,
  ADD COLUMN "interactionTarget" TEXT;
