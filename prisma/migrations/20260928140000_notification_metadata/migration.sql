-- Benachrichtigungen: Kategorie, Art, Priorität, Ziel-Link, Bündelung (Plan docs/benachrichtigungen-plan.md, Phase 1)
ALTER TABLE "Notification"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN "actionUrl" TEXT,
  ADD COLUMN "groupKey" TEXT,
  ADD COLUMN "showId" TEXT,
  ADD COLUMN "actorId" TEXT,
  ADD COLUMN "data" JSONB;

CREATE INDEX "Notification_groupKey_idx" ON "Notification"("groupKey");

ALTER TABLE "NotificationRecipient"
  ADD COLUMN "doneAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "pushedAt" TIMESTAMP(3);

CREATE INDEX "NotificationRecipient_userId_archivedAt_doneAt_idx"
  ON "NotificationRecipient"("userId", "archivedAt", "doneAt");

-- Altbestand aus `type` ableiten
UPDATE "Notification" SET "category" = 'proben'
  WHERE "type" IN ('rehearsal', 'rehearsal-update', 'rehearsal-emergency', 'rehearsal-attendance');
UPDATE "Notification" SET "category" = 'termine' WHERE "type" = 'calendar-event';
UPDATE "Notification" SET "category" = 'gewerke'
  WHERE "type" IN ('department-assignment', 'department-request', 'department-event', 'department-task');
UPDATE "Notification" SET "category" = 'produktion' WHERE "type" = 'photo-consent';

UPDATE "Notification" SET "priority" = 'urgent'
  WHERE "type" IN ('rehearsal-emergency', 'test-emergency');

UPDATE "Notification" SET "kind" = 'action'
  WHERE "type" IN ('department-request', 'rehearsal-emergency')
     OR ("type" = 'photo-consent' AND "title" LIKE 'Fotoerlaubnis eingereicht:%');

UPDATE "Notification" SET "actionUrl" = '/mitglieder/proben/' || "eventId" WHERE "eventId" IS NOT NULL;
UPDATE "Notification" SET "actionUrl" = '/mitglieder/meine-gewerke' WHERE "category" = 'gewerke';
UPDATE "Notification" SET "actionUrl" = '/mitglieder/fotoerlaubnisse' WHERE "type" = 'photo-consent';

UPDATE "Notification" SET "groupKey" = 'decline:' || "eventId"
  WHERE "type" IN ('rehearsal-attendance', 'rehearsal-emergency') AND "eventId" IS NOT NULL;

-- Alte Einträge gelten als erledigt, damit die neue Glocke nicht mit Altlasten startet
UPDATE "NotificationRecipient" SET "doneAt" = COALESCE("readAt", NOW())
  WHERE "notificationId" IN (SELECT "id" FROM "Notification" WHERE "kind" = 'action')
    AND "readAt" IS NOT NULL;
