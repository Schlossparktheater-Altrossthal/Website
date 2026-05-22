-- AlterTable
ALTER TABLE "HomepageCountdown"
ADD COLUMN "termine" JSONB,
ADD COLUMN "nachSommerText" TEXT NOT NULL DEFAULT 'Bis zum nächsten Sommer!';

-- CreateTable
CREATE TABLE "HomepageFlyer" (
  "id" TEXT NOT NULL DEFAULT 'public',
  "aktiv" BOOLEAN NOT NULL DEFAULT false,
  "titel" TEXT,
  "beschreibung" TEXT,
  "bildData" BYTEA,
  "bildMimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomepageFlyer_pkey" PRIMARY KEY ("id")
);
