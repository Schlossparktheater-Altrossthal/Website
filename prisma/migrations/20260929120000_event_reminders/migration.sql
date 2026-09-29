-- Vorlaufzeit für Termin-Erinnerungen je Nutzer (Code laut
-- src/lib/notifications/preferences.ts; NULL = Standardwert).
ALTER TABLE "NotificationSettings" ADD COLUMN "reminderLead" TEXT;

-- Protokoll der versendeten Termin-Erinnerungen: höchstens eine Zeile je Termin und Person.
CREATE TABLE "EventReminderDispatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReminderDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventReminderDispatch_eventId_userId_key" ON "EventReminderDispatch"("eventId", "userId");

CREATE INDEX "EventReminderDispatch_userId_idx" ON "EventReminderDispatch"("userId");

ALTER TABLE "EventReminderDispatch" ADD CONSTRAINT "EventReminderDispatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventReminderDispatch" ADD CONSTRAINT "EventReminderDispatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
