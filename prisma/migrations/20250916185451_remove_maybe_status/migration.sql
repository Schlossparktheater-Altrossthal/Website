-- CreateEnum
CREATE TYPE "public"."RehearsalProposalStatus" AS ENUM ('proposed', 'approved', 'rejected', 'scheduled');

-- AlterEnum
ALTER TYPE "public"."AttendanceStatus" ADD VALUE 'emergency';

-- AlterTable
ALTER TABLE "public"."Rehearsal" ADD COLUMN     "registrationDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."RehearsalAttendance" ADD COLUMN     "emergencyReason" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "passwordHash" TEXT;
