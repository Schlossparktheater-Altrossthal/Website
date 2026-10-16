-- Wunschliste: Herkunft nachgetragener Wünsche und interne Notiz je Person/Produktion
ALTER TABLE "MemberRolePreference" ADD COLUMN "enteredById" TEXT;

ALTER TABLE "MemberRolePreference" ADD CONSTRAINT "MemberRolePreference_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MemberWishNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberWishNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberWishNote_userId_showId_key" ON "MemberWishNote"("userId", "showId");
CREATE INDEX "MemberWishNote_showId_idx" ON "MemberWishNote"("showId");

ALTER TABLE "MemberWishNote" ADD CONSTRAINT "MemberWishNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberWishNote" ADD CONSTRAINT "MemberWishNote_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberWishNote" ADD CONSTRAINT "MemberWishNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
