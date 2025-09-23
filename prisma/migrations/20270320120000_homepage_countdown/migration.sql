-- CreateTable
CREATE TABLE "public"."HomepageCountdown" (
    "id" TEXT NOT NULL DEFAULT 'public',
    "countdownTarget" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HomepageCountdown_pkey" PRIMARY KEY ("id")
);

-- Seed default countdown
INSERT INTO "public"."HomepageCountdown" ("id", "countdownTarget")
VALUES ('public', '2026-06-18T17:00:00.000Z')
ON CONFLICT ("id") DO UPDATE SET
    "countdownTarget" = EXCLUDED."countdownTarget",
    "updatedAt" = CURRENT_TIMESTAMP;
