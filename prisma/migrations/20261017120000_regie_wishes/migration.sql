-- Regie-Dashboard: Wünsche an die Planung und „neu seit letztem Besuch“ (docs/Plan/regie-plan.md, Phase 3+5).
-- CreateEnum
CREATE TYPE "DirectionWishStatus" AS ENUM ('open', 'planned', 'done', 'declined');
-- CreateTable
CREATE TABLE "DirectionWish" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "authorId" TEXT,
    "text" TEXT NOT NULL,
    "status" "DirectionWishStatus" NOT NULL DEFAULT 'open',
    "sceneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "eventId" TEXT,
    "statusAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DirectionWish_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "DirectionWishMessage" (
    "id" TEXT NOT NULL,
    "wishId" TEXT NOT NULL,
    "authorId" TEXT,
    "text" TEXT,
    "status" "DirectionWishStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectionWishMessage_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "DirectionVisit" (
    "userId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "previousAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectionVisit_pkey" PRIMARY KEY ("userId","showId")
);
-- CreateIndex
CREATE INDEX "DirectionWish_showId_status_idx" ON "DirectionWish"("showId", "status");
-- CreateIndex
CREATE INDEX "DirectionWish_eventId_idx" ON "DirectionWish"("eventId");
-- CreateIndex
CREATE INDEX "DirectionWishMessage_wishId_createdAt_idx" ON "DirectionWishMessage"("wishId", "createdAt");
-- AddForeignKey
ALTER TABLE "DirectionWish" ADD CONSTRAINT "DirectionWish_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWish" ADD CONSTRAINT "DirectionWish_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWish" ADD CONSTRAINT "DirectionWish_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishMessage" ADD CONSTRAINT "DirectionWishMessage_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "DirectionWish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishMessage" ADD CONSTRAINT "DirectionWishMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionVisit" ADD CONSTRAINT "DirectionVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionVisit" ADD CONSTRAINT "DirectionVisit_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
