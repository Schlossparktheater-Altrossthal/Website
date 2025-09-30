-- CreateTable
CREATE TABLE "analytics_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "httpWindowMinutes" INTEGER NOT NULL DEFAULT 1440,
    "httpBucketMinutes" INTEGER NOT NULL DEFAULT 60,
    "sessionWindowDays" INTEGER NOT NULL DEFAULT 30,
    "sessionRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "realtimeWindowHours" INTEGER NOT NULL DEFAULT 24,
    "pageWindowDays" INTEGER NOT NULL DEFAULT 14,
    "pageRetentionDays" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_settings_pkey" PRIMARY KEY ("id")
);

-- CreateFunction
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTrigger
CREATE TRIGGER "analytics_settings_set_updated_at"
BEFORE UPDATE ON "analytics_settings"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();
