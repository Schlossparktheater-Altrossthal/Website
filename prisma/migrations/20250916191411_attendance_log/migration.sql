/*
  Warnings:

  - The values [mm,cm,inch] on the enum `MeasurementUnit` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `key` on the `MemberMeasurement` table. All the data in the column will be lost.
  - You are about to drop the column `takenAt` on the `MemberMeasurement` table. All the data in the column will be lost.
  - You are about to drop the column `takenBy` on the `MemberMeasurement` table. All the data in the column will be lost.
  - You are about to drop the column `system` on the `MemberSize` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `MemberSize` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,type]` on the table `MemberMeasurement` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,category]` on the table `MemberSize` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `MemberMeasurement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MemberMeasurement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `MemberSize` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `category` on the `MemberSize` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."MeasurementType" AS ENUM ('HEIGHT', 'CHEST', 'WAIST', 'HIPS', 'INSEAM', 'SHOULDER', 'SLEEVE', 'SHOE_SIZE', 'HEAD');

-- CreateEnum
CREATE TYPE "public"."AllergyLevel" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'LETHAL');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."MeasurementUnit_new" AS ENUM ('CM', 'INCH', 'EU', 'DE');
ALTER TABLE "public"."MemberMeasurement" ALTER COLUMN "unit" DROP DEFAULT;
ALTER TABLE "public"."MemberMeasurement" ALTER COLUMN "unit" TYPE "public"."MeasurementUnit_new" USING ("unit"::text::"public"."MeasurementUnit_new");
ALTER TYPE "public"."MeasurementUnit" RENAME TO "MeasurementUnit_old";
ALTER TYPE "public"."MeasurementUnit_new" RENAME TO "MeasurementUnit";
DROP TYPE "public"."MeasurementUnit_old";
COMMIT;

-- DropIndex
DROP INDEX "public"."MemberMeasurement_userId_key_takenAt_idx";

-- DropIndex
DROP INDEX "public"."MemberSize_userId_category_system_idx";

-- AlterTable
ALTER TABLE "public"."MemberMeasurement" DROP COLUMN "key",
DROP COLUMN "takenAt",
DROP COLUMN "takenBy",
ADD COLUMN     "type" "public"."MeasurementType" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "unit" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."MemberSize" DROP COLUMN "system",
DROP COLUMN "value",
ADD COLUMN     "size" TEXT NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" TEXT NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropEnum
DROP TYPE "public"."SizeCategory";

-- DropEnum
DROP TYPE "public"."SizeSystem";

-- CreateTable
CREATE TABLE "public"."DietaryRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "level" "public"."AllergyLevel" NOT NULL,
    "symptoms" TEXT,
    "treatment" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietaryRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RehearsalProposal" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Probenvorschlag',
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "location" TEXT,
    "requiredRoles" JSONB NOT NULL,
    "status" "public"."RehearsalProposalStatus" NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectionReason" TEXT,
    "rehearsalId" TEXT,

    CONSTRAINT "RehearsalProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DietaryRestriction_userId_allergen_key" ON "public"."DietaryRestriction"("userId", "allergen");

-- CreateIndex
CREATE INDEX "RehearsalProposal_date_status_idx" ON "public"."RehearsalProposal"("date", "status");

-- CreateIndex
CREATE INDEX "RehearsalProposal_showId_status_idx" ON "public"."RehearsalProposal"("showId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MemberMeasurement_userId_type_key" ON "public"."MemberMeasurement"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MemberSize_userId_category_key" ON "public"."MemberSize"("userId", "category");

-- AddForeignKey
ALTER TABLE "public"."DietaryRestriction" ADD CONSTRAINT "DietaryRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalProposal" ADD CONSTRAINT "RehearsalProposal_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalProposal" ADD CONSTRAINT "RehearsalProposal_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalProposal" ADD CONSTRAINT "RehearsalProposal_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "public"."Rehearsal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
