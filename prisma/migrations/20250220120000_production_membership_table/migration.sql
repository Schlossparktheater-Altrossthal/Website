-- CreateTable
CREATE TABLE "public"."ProductionMembership" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "ProductionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMembership_showId_userId_key" ON "public"."ProductionMembership"("showId", "userId");

-- CreateIndex
CREATE INDEX "ProductionMembership_userId_leftAt_idx" ON "public"."ProductionMembership"("userId", "leftAt");

-- CreateIndex
CREATE INDEX "ProductionMembership_showId_leftAt_idx" ON "public"."ProductionMembership"("showId", "leftAt");

-- AddForeignKey
ALTER TABLE "public"."ProductionMembership"
  ADD CONSTRAINT "ProductionMembership_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionMembership"
  ADD CONSTRAINT "ProductionMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
