-- Probenmodus: Anwesenheit mit Status, tatsächliche Zeiten, spontane Punkte, Gäste.
CREATE TYPE "public"."AttendanceMark" AS ENUM ('PRESENT', 'LATE', 'LEFT_EARLY', 'ABSENT', 'EXCUSED');

ALTER TABLE "public"."CalendarEvent"
  ADD COLUMN "actualStart" TIMESTAMP(3),
  ADD COLUMN "actualEnd" TIMESTAMP(3);

ALTER TABLE "public"."EventBlock"
  ADD COLUMN "actualStart" TIMESTAMP(3),
  ADD COLUMN "actualEnd" TIMESTAMP(3),
  ADD COLUMN "actualOrder" INTEGER,
  ADD COLUMN "unplanned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."EventParticipant"
  ADD COLUMN "attendance" "public"."AttendanceMark",
  ADD COLUMN "arrivedAt" TIMESTAMP(3),
  ADD COLUMN "leftAt" TIMESTAMP(3);

-- Bisherige Nachbereitung übernehmen: anwesend bzw. gefehlt (abgesagt → entschuldigt).
UPDATE "public"."EventParticipant"
SET "attendance" = CASE
  WHEN "attended" = true THEN 'PRESENT'::"public"."AttendanceMark"
  WHEN "response" IN ('no', 'emergency') THEN 'EXCUSED'::"public"."AttendanceMark"
  ELSE 'ABSENT'::"public"."AttendanceMark"
END
WHERE "attended" IS NOT NULL;

ALTER TABLE "public"."EventParticipant" DROP COLUMN "attended";

CREATE TABLE "public"."EventGuest" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventGuest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventGuest_eventId_idx" ON "public"."EventGuest"("eventId");
ALTER TABLE "public"."EventGuest" ADD CONSTRAINT "EventGuest_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "public"."CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
