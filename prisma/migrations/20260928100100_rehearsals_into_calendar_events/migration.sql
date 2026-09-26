-- Proben laufen ab jetzt über CalendarEvent (Terminplanung Phase 1, docs/terminplanung-plan.md).

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipationLevel" AS ENUM ('REQUIRED', 'OPTIONAL');

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "responseDeadline" TIMESTAMP(3),
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED';

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ParticipationLevel" NOT NULL DEFAULT 'REQUIRED',
    "invited" BOOLEAN NOT NULL DEFAULT true,
    "response" "AttendanceStatus",
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventResponseLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previous" "AttendanceStatus",
    "next" "AttendanceStatus",
    "comment" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT NOT NULL,

    CONSTRAINT "EventResponseLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventParticipant_userId_idx" ON "EventParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_userId_key" ON "EventParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventResponseLog_eventId_changedAt_idx" ON "EventResponseLog"("eventId", "changedAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_kind_start_idx" ON "CalendarEvent"("kind", "start");

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResponseLog" ADD CONSTRAINT "EventResponseLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResponseLog" ADD CONSTRAINT "EventResponseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResponseLog" ADD CONSTRAINT "EventResponseLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Datenübernahme: Proben werden Termine (kind REHEARSAL). IDs bleiben, damit Links,
-- Realtime-Räume und Kalender-Abos stabil bleiben.
INSERT INTO "CalendarEvent" ("id", "title", "kind", "status", "start", "end", "allDay", "location", "description", "responseDeadline", "showId", "createdById", "createdAt", "updatedAt")
SELECT r."id", r."title", 'REHEARSAL',
       CASE r."status" WHEN 'DRAFT' THEN 'DRAFT'::"EventStatus" WHEN 'CANCELLED' THEN 'CANCELLED'::"EventStatus" ELSE 'SCHEDULED'::"EventStatus" END,
       r."start", r."end", false, r."location", r."description", r."registrationDeadline", r."showId",
       (SELECT u."id" FROM "User" u WHERE u."id" = r."createdBy"),
       r."createdAt", r."updatedAt"
FROM "Rehearsal" r;

-- Eingeladene und Rückmeldungen der Proben
INSERT INTO "EventParticipant" ("id", "eventId", "userId", "level", "invited", "response", "responseNote", "respondedAt", "createdAt", "updatedAt")
SELECT 'ep_' || md5(p."rehearsalId" || ':' || p."userId"), p."rehearsalId", p."userId", 'REQUIRED',
       EXISTS (SELECT 1 FROM "RehearsalInvitee" i WHERE i."rehearsalId" = p."rehearsalId" AND i."userId" = p."userId"),
       a."status", a."emergencyReason",
       CASE WHEN a."id" IS NULL THEN NULL ELSE (SELECT max(l."changedAt") FROM "RehearsalAttendanceLog" l WHERE l."rehearsalId" = p."rehearsalId" AND l."userId" = p."userId") END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT "rehearsalId", "userId" FROM "RehearsalInvitee"
  UNION
  SELECT "rehearsalId", "userId" FROM "RehearsalAttendance"
) p
LEFT JOIN "RehearsalAttendance" a ON a."rehearsalId" = p."rehearsalId" AND a."userId" = p."userId";

-- Rückmeldungen zu Terminen für ganze Gruppen (Gewerk, Produktion)
INSERT INTO "EventParticipant" ("id", "eventId", "userId", "level", "invited", "response", "respondedAt", "createdAt", "updatedAt")
SELECT 'ep_' || md5(c."eventId" || ':' || c."userId"), c."eventId", c."userId", 'REQUIRED', false,
       c."status"::text::"AttendanceStatus", c."updatedAt", c."updatedAt", c."updatedAt"
FROM "CalendarEventResponse" c
ON CONFLICT ("eventId", "userId") DO NOTHING;

INSERT INTO "EventResponseLog" ("id", "eventId", "userId", "previous", "next", "comment", "changedAt", "changedById")
SELECT l."id", l."rehearsalId", l."userId", l."previous", l."next", l."comment", l."changedAt", l."changedById"
FROM "RehearsalAttendanceLog" l;

-- Benachrichtigungen zeigen auf den Termin statt auf die Probe
ALTER TABLE "Notification" ADD COLUMN "eventId" TEXT;
UPDATE "Notification" SET "eventId" = "rehearsalId";
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_rehearsalId_fkey";
ALTER TABLE "Notification" DROP COLUMN "rehearsalId";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Altbestand entfernen (Vorschläge, Vorlagen und requiredRoles hatten keine Oberfläche mehr)
-- DropForeignKey
ALTER TABLE "CalendarEventResponse" DROP CONSTRAINT "CalendarEventResponse_eventId_fkey";

-- DropForeignKey
ALTER TABLE "CalendarEventResponse" DROP CONSTRAINT "CalendarEventResponse_userId_fkey";

-- DropForeignKey
ALTER TABLE "Rehearsal" DROP CONSTRAINT "Rehearsal_showId_fkey";

-- DropForeignKey
ALTER TABLE "Rehearsal" DROP CONSTRAINT "Rehearsal_templateId_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalAttendance" DROP CONSTRAINT "RehearsalAttendance_rehearsalId_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalAttendance" DROP CONSTRAINT "RehearsalAttendance_userId_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalAttendanceLog" DROP CONSTRAINT "RehearsalAttendanceLog_changedById_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalAttendanceLog" DROP CONSTRAINT "RehearsalAttendanceLog_rehearsalId_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalAttendanceLog" DROP CONSTRAINT "RehearsalAttendanceLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalInvitee" DROP CONSTRAINT "RehearsalInvitee_rehearsalId_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalInvitee" DROP CONSTRAINT "RehearsalInvitee_userId_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalProposal" DROP CONSTRAINT "RehearsalProposal_approvedBy_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalProposal" DROP CONSTRAINT "RehearsalProposal_rehearsalId_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalProposal" DROP CONSTRAINT "RehearsalProposal_showId_fkey";

-- DropTable
DROP TABLE "CalendarEventResponse";

-- DropTable
DROP TABLE "Rehearsal";

-- DropTable
DROP TABLE "RehearsalAttendance";

-- DropTable
DROP TABLE "RehearsalAttendanceLog";

-- DropTable
DROP TABLE "RehearsalInvitee";

-- DropTable
DROP TABLE "RehearsalProposal";

-- DropTable
DROP TABLE "RehearsalTemplate";

-- DropEnum
DROP TYPE "EventResponseStatus";

-- DropEnum
DROP TYPE "RehearsalPriority";

-- DropEnum
DROP TYPE "RehearsalProposalStatus";

-- DropEnum
DROP TYPE "RehearsalStatus";
