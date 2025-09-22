-- DropForeignKey
ALTER TABLE "public"."AvailabilityDay" DROP CONSTRAINT "AvailabilityDay_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AvailabilityTemplate" DROP CONSTRAINT "AvailabilityTemplate_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Issue" DROP CONSTRAINT "Issue_createdById_fkey";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Issue" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."AvailabilityDay" ADD CONSTRAINT "AvailabilityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AvailabilityTemplate" ADD CONSTRAINT "AvailabilityTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

