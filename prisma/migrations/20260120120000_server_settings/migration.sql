-- CreateTable
CREATE TABLE "public"."ServerSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "mailHost" TEXT,
    "mailPort" INTEGER NOT NULL DEFAULT 587,
    "mailSecure" BOOLEAN NOT NULL DEFAULT false,
    "mailUsername" TEXT,
    "mailPassword" TEXT,
    "mailFromAddress" TEXT,
    "mailFromName" TEXT,
    "mailReplyTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerSettings_pkey" PRIMARY KEY ("id")
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
CREATE TRIGGER "ServerSettings_set_updated_at"
BEFORE UPDATE ON "public"."ServerSettings"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();
