CREATE TABLE "public"."MysterySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "countdownTarget" TIMESTAMP(3),
    "expirationMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MysterySettings_pkey" PRIMARY KEY ("id")
);
