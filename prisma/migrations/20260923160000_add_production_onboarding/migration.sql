-- CreateTable
CREATE TABLE "ProductionOnboarding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "showId" TEXT NOT NULL,
  "inviteId" TEXT,
  "redemptionId" TEXT,
  "focus" "OnboardingFocus" NOT NULL,
  "profileSnapshot" JSONB,
  "isReturning" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOnboarding_redemptionId_key" ON "ProductionOnboarding"("redemptionId");
CREATE UNIQUE INDEX "ProductionOnboarding_userId_showId_key" ON "ProductionOnboarding"("userId", "showId");
CREATE INDEX "ProductionOnboarding_showId_completedAt_idx" ON "ProductionOnboarding"("showId", "completedAt");
CREATE INDEX "ProductionOnboarding_inviteId_idx" ON "ProductionOnboarding"("inviteId");

-- AddForeignKey
ALTER TABLE "ProductionOnboarding" ADD CONSTRAINT "ProductionOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOnboarding" ADD CONSTRAINT "ProductionOnboarding_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOnboarding" ADD CONSTRAINT "ProductionOnboarding_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "MemberInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionOnboarding" ADD CONSTRAINT "ProductionOnboarding_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "MemberInviteRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: Bisherige Onboarding-Profile werden zu Onboardings ihrer Produktion. Profile ohne
-- Produktion gehören zur bisher einzigen bzw. aktiven Produktion ("Die unendliche Geschichte").
-- Ein vorhandenes Profil bedeutet ein durchlaufenes Onboarding (Bestand ohne Einladungslink).
INSERT INTO "ProductionOnboarding" (
  "id", "userId", "showId", "inviteId", "redemptionId", "focus", "completedAt", "createdAt", "updatedAt"
)
SELECT
  'po_' || md5(p."id"),
  p."userId",
  COALESCE(p."showId", i."showId", fallback."id"),
  p."inviteId",
  p."redemptionId",
  p."focus",
  COALESCE(r."completedAt", u."onboardingCompletedAt", p."createdAt"),
  p."createdAt",
  p."updatedAt"
FROM "MemberOnboardingProfile" p
JOIN "User" u ON u."id" = p."userId"
LEFT JOIN "MemberInvite" i ON i."id" = p."inviteId"
LEFT JOIN "MemberInviteRedemption" r ON r."id" = p."redemptionId"
LEFT JOIN LATERAL (
  SELECT "id" FROM "Show"
  ORDER BY ("status" = 'active') DESC, "year" DESC, "id" DESC
  LIMIT 1
) fallback ON TRUE
WHERE COALESCE(p."showId", i."showId", fallback."id") IS NOT NULL
ON CONFLICT ("userId", "showId") DO NOTHING;
