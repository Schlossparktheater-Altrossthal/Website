ALTER TABLE "SperrlisteSettings"
ADD COLUMN "publicHolidaySourceMode" TEXT NOT NULL DEFAULT 'default';

ALTER TABLE "SperrlisteSettings"
ADD COLUMN "publicHolidaySourceUrl" TEXT;

ALTER TABLE "SperrlisteSettings"
ADD COLUMN "publicHolidaySourceStatus" TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE "SperrlisteSettings"
ADD COLUMN "publicHolidaySourceMessage" TEXT;

ALTER TABLE "SperrlisteSettings"
ADD COLUMN "publicHolidaySourceCheckedAt" TIMESTAMP(3);
