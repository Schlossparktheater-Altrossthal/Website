-- CreateEnum
CREATE TYPE "AvatarSource" AS ENUM ('GRAVATAR', 'UPLOAD', 'INITIALS');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "avatarSource" "AvatarSource" NOT NULL DEFAULT 'GRAVATAR',
  ADD COLUMN "avatarImage" BYTEA,
  ADD COLUMN "avatarImageMime" TEXT,
  ADD COLUMN "avatarImageUpdatedAt" TIMESTAMP(3);

-- DropDefault for new enum column to avoid locking future writes
ALTER TABLE "User" ALTER COLUMN "avatarSource" DROP DEFAULT;
