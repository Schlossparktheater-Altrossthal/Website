-- CreateEnum
CREATE TYPE "ScriptSessionKind" AS ENUM ('group', 'private');

-- CreateEnum
CREATE TYPE "ScriptSessionStatus" AS ENUM ('recording', 'draft', 'confirmed', 'discarded');

-- CreateTable
CREATE TABLE "ScriptSession" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" "ScriptSessionKind" NOT NULL,
    "status" "ScriptSessionStatus" NOT NULL DEFAULT 'recording',
    "ownerId" TEXT NOT NULL,
    "title" TEXT,
    "eventId" TEXT,
    "groupSessionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptSessionSample" (
    "sessionId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "pos" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 0,
    "roleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ScriptSessionSample_pkey" PRIMARY KEY ("sessionId","at")
);

-- CreateIndex
CREATE INDEX "ScriptSession_versionId_kind_startedAt_idx" ON "ScriptSession"("versionId", "kind", "startedAt");

-- CreateIndex
CREATE INDEX "ScriptSession_ownerId_startedAt_idx" ON "ScriptSession"("ownerId", "startedAt");

-- CreateIndex
CREATE INDEX "ScriptSession_eventId_idx" ON "ScriptSession"("eventId");

-- AddForeignKey
ALTER TABLE "ScriptSession" ADD CONSTRAINT "ScriptSession_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScriptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptSession" ADD CONSTRAINT "ScriptSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptSession" ADD CONSTRAINT "ScriptSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptSession" ADD CONSTRAINT "ScriptSession_groupSessionId_fkey" FOREIGN KEY ("groupSessionId") REFERENCES "ScriptSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptSessionSample" ADD CONSTRAINT "ScriptSessionSample_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScriptSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

