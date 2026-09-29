-- Zusätzliche Angaben an Allergien und Unverträglichkeiten (Art, „Spuren unproblematisch",
-- „ärztlich abgeklärt"), eine eigene Liste für Abneigungen und Besonderheiten sowie die Unterform
-- des Ernährungsstils (z. B. „Nur Milch, kein Ei" bei vegetarisch).
--
-- Die Anweisungen sind idempotent, weil Prisma auf Postgres nicht transaktional migriert: ein
-- fehlgeschlagener Lauf hinterlässt sonst Teilzustand (bereits angelegte Spalten/Typen) und
-- blockiert den nächsten Versuch.

DO $$
BEGIN
  CREATE TYPE "RestrictionKind" AS ENUM ('ALLERGY', 'INTOLERANCE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "DietaryRestriction" ADD COLUMN IF NOT EXISTS "kind" "RestrictionKind" NOT NULL DEFAULT 'ALLERGY';
ALTER TABLE "DietaryRestriction" ADD COLUMN IF NOT EXISTS "tracesOk" BOOLEAN;
ALTER TABLE "DietaryRestriction" ADD COLUMN IF NOT EXISTS "diagnosed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "DietaryAversion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DietaryAversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DietaryAversion_userId_label_key" ON "DietaryAversion"("userId", "label");

DO $$
BEGIN
  ALTER TABLE "DietaryAversion"
    ADD CONSTRAINT "DietaryAversion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "MemberOnboardingProfile" ADD COLUMN IF NOT EXISTS "dietaryPreferenceVariant" TEXT;
