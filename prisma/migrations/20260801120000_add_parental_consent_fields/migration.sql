-- AlterTable
ALTER TABLE "public"."ServerSettings"
  ADD COLUMN "parentalConsentData" BYTEA,
  ADD COLUMN "parentalConsentMime" TEXT,
  ADD COLUMN "parentalConsentName" TEXT,
  ADD COLUMN "parentalConsentSize" INTEGER,
  ADD COLUMN "parentalConsentUploadedAt" TIMESTAMP(3),
  ADD COLUMN "parentalConsentUploadedById" TEXT;

-- AddForeignKey
ALTER TABLE "public"."ServerSettings"
  ADD CONSTRAINT "ServerSettings_parentalConsentUploadedById_fkey"
  FOREIGN KEY ("parentalConsentUploadedById") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
