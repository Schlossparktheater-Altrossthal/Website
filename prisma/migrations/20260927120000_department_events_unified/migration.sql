-- Gewerk-Termine laufen ab jetzt über CalendarEvent (ein Termin-System) mit Zu-/Absagen.

-- CreateEnum
CREATE TYPE "EventResponseStatus" AS ENUM ('yes', 'maybe', 'no');

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "departmentId" TEXT;

-- CreateIndex
CREATE INDEX "CalendarEvent_departmentId_start_idx" ON "CalendarEvent"("departmentId", "start");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestehende Gewerk-Termine übernehmen (IDs bleiben, damit Kalender-Abos stabil bleiben).
INSERT INTO "CalendarEvent" ("id", "title", "kind", "start", "end", "allDay", "location", "description", "showId", "departmentId", "createdById", "createdAt", "updatedAt")
SELECT e."id", e."title", 'MEETING', e."start", e."end", false, e."location", e."description", d."showId", e."departmentId", e."createdById", e."createdAt", e."updatedAt"
FROM "DepartmentEvent" e
JOIN "Department" d ON d."id" = e."departmentId"
ON CONFLICT ("id") DO NOTHING;

-- DropForeignKey
ALTER TABLE "DepartmentEvent" DROP CONSTRAINT "DepartmentEvent_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DepartmentEvent" DROP CONSTRAINT "DepartmentEvent_departmentId_fkey";

-- DropTable
DROP TABLE "DepartmentEvent";

-- CreateTable
CREATE TABLE "CalendarEventResponse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventResponseStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventResponse_eventId_userId_key" ON "CalendarEventResponse"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "CalendarEventResponse" ADD CONSTRAINT "CalendarEventResponse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventResponse" ADD CONSTRAINT "CalendarEventResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
