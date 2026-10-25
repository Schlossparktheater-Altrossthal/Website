-- Aufgaben-Mails abschaltbar; Verwaltungs-Hinweise bekommen den neuen Bereich „verwaltung“.
ALTER TABLE "NotificationPreference" ADD COLUMN "actionEmail" BOOLEAN;
