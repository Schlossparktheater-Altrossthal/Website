-- DropForeignKey
ALTER TABLE IF EXISTS "public"."AvailabilityDay" DROP CONSTRAINT IF EXISTS "AvailabilityDay_userId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "public"."AvailabilityTemplate" DROP CONSTRAINT IF EXISTS "AvailabilityTemplate_userId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "public"."Issue" DROP CONSTRAINT IF EXISTS "Issue_createdById_fkey";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE IF EXISTS "public"."Issue" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE IF EXISTS "public"."AvailabilityDay" ADD CONSTRAINT "AvailabilityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "public"."AvailabilityTemplate" ADD CONSTRAINT "AvailabilityTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "public"."Issue" ADD CONSTRAINT "Issue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

