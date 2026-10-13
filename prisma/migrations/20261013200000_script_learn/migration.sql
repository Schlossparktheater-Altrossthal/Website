-- Skript: Lernmodus (docs/Plan/lernmodus-plan.md)
-- CreateTable
CREATE TABLE "ScriptLearnCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "chunk" INTEGER NOT NULL,
    "textHash" TEXT NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3) NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptLearnCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptLearnReview" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "auto" BOOLEAN NOT NULL DEFAULT true,
    "revealed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptLearnReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptLearnProfile" (
    "userId" TEXT NOT NULL,
    "weeklyDays" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptLearnProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "ScriptLearnCard_userId_showId_idx" ON "ScriptLearnCard"("userId", "showId");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptLearnCard_userId_roleId_lineageId_chunk_key" ON "ScriptLearnCard"("userId", "roleId", "lineageId", "chunk");

-- CreateIndex
CREATE INDEX "ScriptLearnReview_cardId_reviewedAt_idx" ON "ScriptLearnReview"("cardId", "reviewedAt");

-- AddForeignKey
ALTER TABLE "ScriptLearnCard" ADD CONSTRAINT "ScriptLearnCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptLearnCard" ADD CONSTRAINT "ScriptLearnCard_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptLearnCard" ADD CONSTRAINT "ScriptLearnCard_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ScriptRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptLearnReview" ADD CONSTRAINT "ScriptLearnReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "ScriptLearnCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptLearnProfile" ADD CONSTRAINT "ScriptLearnProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
