-- CreateTable
CREATE TABLE "public"."FinalRehearsalDuty" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startTime" INTEGER,
    "endTime" INTEGER,
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalRehearsalDuty_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."FinalRehearsalDuty"
  ADD CONSTRAINT "FinalRehearsalDuty_showId_fkey"
  FOREIGN KEY ("showId")
  REFERENCES "public"."Show"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "public"."FinalRehearsalDuty"
  ADD CONSTRAINT "FinalRehearsalDuty_assigneeId_fkey"
  FOREIGN KEY ("assigneeId")
  REFERENCES "public"."User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "public"."FinalRehearsalDuty"
  ADD CONSTRAINT "FinalRehearsalDuty_createdById_fkey"
  FOREIGN KEY ("createdById")
  REFERENCES "public"."User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "FinalRehearsalDuty_showId_date_idx"
  ON "public"."FinalRehearsalDuty"("showId", "date");

CREATE INDEX "FinalRehearsalDuty_assigneeId_idx"
  ON "public"."FinalRehearsalDuty"("assigneeId");
