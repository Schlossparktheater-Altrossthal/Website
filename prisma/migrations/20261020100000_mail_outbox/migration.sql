-- E-Mail modernisieren (docs/Plan/email-plan.md)
CREATE TABLE "MailOutbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "headers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MailOutbox_status_nextAttemptAt_idx" ON "MailOutbox"("status", "nextAttemptAt");
CREATE INDEX "MailOutbox_createdAt_idx" ON "MailOutbox"("createdAt");

ALTER TABLE "NotificationPreference" ADD COLUMN "emailMode" TEXT;
ALTER TABLE "NotificationSettings" ADD COLUMN "digest" TEXT;
ALTER TABLE "NotificationSettings" ADD COLUMN "digestSentAt" TIMESTAMP(3);
ALTER TABLE "NotificationRecipient" ADD COLUMN "emailedAt" TIMESTAMP(3);
