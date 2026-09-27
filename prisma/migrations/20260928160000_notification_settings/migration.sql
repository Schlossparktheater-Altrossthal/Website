-- Ruhezeit für Push (Plan docs/benachrichtigungen-plan.md, Phase 6)
CREATE TABLE "NotificationSettings" (
    "userId" TEXT NOT NULL,
    "quietStart" INTEGER,
    "quietEnd" INTEGER,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
