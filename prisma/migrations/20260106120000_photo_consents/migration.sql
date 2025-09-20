-- CreateEnum
CREATE TYPE "public"."PhotoConsentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "public"."PhotoConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."PhotoConsentStatus" NOT NULL DEFAULT 'pending',
    "consentGiven" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "documentName" TEXT,
    "documentMime" TEXT,
    "documentSize" INTEGER,
    "documentUploadedAt" TIMESTAMP(3),
    "documentData" BYTEA,

    CONSTRAINT "PhotoConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoConsent_userId_key" ON "public"."PhotoConsent"("userId");

-- AddForeignKey
ALTER TABLE "public"."PhotoConsent" ADD CONSTRAINT "PhotoConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhotoConsent" ADD CONSTRAINT "PhotoConsent_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
