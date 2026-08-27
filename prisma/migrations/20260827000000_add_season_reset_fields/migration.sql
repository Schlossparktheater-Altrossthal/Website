-- AlterTable
ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SeasonResetSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "protectedRoles" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeasonResetSettings_pkey" PRIMARY KEY ("id")
);
