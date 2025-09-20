-- CreateEnum
CREATE TYPE "public"."OnboardingFocus" AS ENUM ('acting', 'tech', 'both');

-- CreateEnum
CREATE TYPE "public"."RolePreferenceDomain" AS ENUM ('acting', 'crew');

-- CreateTable
CREATE TABLE "public"."MemberInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "roles" "public"."Role"[],
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "MemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberInviteRedemption" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "payload" JSONB,

    CONSTRAINT "MemberInviteRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Interest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberRolePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "domain" "public"."RolePreferenceDomain" NOT NULL,
    "weight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberRolePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberOnboardingProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inviteId" TEXT,
    "redemptionId" TEXT,
    "focus" "public"."OnboardingFocus" NOT NULL,
    "background" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberOnboardingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberInvite_tokenHash_key" ON "public"."MemberInvite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MemberInviteRedemption_sessionToken_key" ON "public"."MemberInviteRedemption"("sessionToken");

-- CreateIndex
CREATE INDEX "MemberInviteRedemption_inviteId_idx" ON "public"."MemberInviteRedemption"("inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "Interest_name_key" ON "public"."Interest"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserInterest_userId_interestId_key" ON "public"."UserInterest"("userId", "interestId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRolePreference_userId_code_key" ON "public"."MemberRolePreference"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MemberOnboardingProfile_userId_key" ON "public"."MemberOnboardingProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberOnboardingProfile_redemptionId_key" ON "public"."MemberOnboardingProfile"("redemptionId");

-- CreateIndex
CREATE INDEX "MemberOnboardingProfile_inviteId_idx" ON "public"."MemberOnboardingProfile"("inviteId");

-- AddForeignKey
ALTER TABLE "public"."MemberInvite" ADD CONSTRAINT "MemberInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberInviteRedemption" ADD CONSTRAINT "MemberInviteRedemption_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "public"."MemberInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberInviteRedemption" ADD CONSTRAINT "MemberInviteRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Interest" ADD CONSTRAINT "Interest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserInterest" ADD CONSTRAINT "UserInterest_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "public"."Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberRolePreference" ADD CONSTRAINT "MemberRolePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberOnboardingProfile" ADD CONSTRAINT "MemberOnboardingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberOnboardingProfile" ADD CONSTRAINT "MemberOnboardingProfile_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "public"."MemberInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberOnboardingProfile" ADD CONSTRAINT "MemberOnboardingProfile_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "public"."MemberInviteRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

