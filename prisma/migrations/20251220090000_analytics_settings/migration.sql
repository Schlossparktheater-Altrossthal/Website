-- CreateTable
CREATE TABLE "analytics_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "http_window_minutes" INTEGER NOT NULL DEFAULT 1440,
    "http_bucket_minutes" INTEGER NOT NULL DEFAULT 60,
    "session_window_days" INTEGER NOT NULL DEFAULT 30,
    "session_retention_days" INTEGER NOT NULL DEFAULT 180,
    "realtime_window_hours" INTEGER NOT NULL DEFAULT 24,
    "page_window_days" INTEGER NOT NULL DEFAULT 14,
    "page_retention_days" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_settings_pkey" PRIMARY KEY ("id")
);

-- CreateFunction
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTrigger
CREATE TRIGGER "analytics_settings_set_updated_at"
BEFORE UPDATE ON "analytics_settings"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();
