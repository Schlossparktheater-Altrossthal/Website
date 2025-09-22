CREATE TABLE "public"."SperrlisteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "holidaySourceMode" TEXT NOT NULL DEFAULT 'default',
    "holidaySourceUrl" TEXT,
    "holidaySourceStatus" TEXT NOT NULL DEFAULT 'unknown',
    "holidaySourceMessage" TEXT,
    "holidaySourceCheckedAt" TIMESTAMP(3),
    "freezeDays" INTEGER NOT NULL DEFAULT 7,
    "preferredWeekdays" JSONB,
    "exceptionWeekdays" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SperrlisteSettings_pkey" PRIMARY KEY ("id")
);
