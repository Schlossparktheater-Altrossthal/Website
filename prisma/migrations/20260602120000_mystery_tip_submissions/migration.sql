-- CreateTable
CREATE TABLE "public"."MysteryTipSubmission" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "clueId" TEXT,
    "playerName" TEXT NOT NULL,
    "tipText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT FALSE,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MysteryTipSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MysteryTipSubmission_tipId_idx" ON "public"."MysteryTipSubmission"("tipId");
CREATE INDEX "MysteryTipSubmission_clueId_idx" ON "public"."MysteryTipSubmission"("clueId");
CREATE INDEX "MysteryTipSubmission_playerName_idx" ON "public"."MysteryTipSubmission"("playerName");

-- AddForeignKey
ALTER TABLE "public"."MysteryTipSubmission"
  ADD CONSTRAINT "MysteryTipSubmission_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "public"."MysteryTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."MysteryTipSubmission"
  ADD CONSTRAINT "MysteryTipSubmission_clueId_fkey" FOREIGN KEY ("clueId") REFERENCES "public"."Clue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
