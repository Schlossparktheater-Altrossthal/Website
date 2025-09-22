-- CreateEnum
CREATE TYPE "BlockedDayKind" AS ENUM ('BLOCKED', 'PREFERRED');

-- AlterTable
ALTER TABLE "BlockedDay"
  ADD COLUMN "kind" "BlockedDayKind" NOT NULL DEFAULT 'BLOCKED';
