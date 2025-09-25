-- Add showId column to MemberInvite and backfill existing rows if possible
ALTER TABLE "public"."MemberInvite"
ADD COLUMN IF NOT EXISTS "showId" TEXT;

-- Attempt to backfill showId with the latest active show when available.
-- This assumes there is at least one show and that invites should default to the latest show.
-- If the application requires a specific mapping, this step should be replaced accordingly.
WITH latest_show AS (
  SELECT "id"
  FROM "public"."Show"
  ORDER BY "premiere" DESC NULLS LAST, "createdAt" DESC
  LIMIT 1
)
UPDATE "public"."MemberInvite" AS mi
SET "showId" = ls."id"
FROM latest_show AS ls
WHERE mi."showId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."MemberInvite" WHERE "showId" IS NULL) THEN
    RAISE EXCEPTION 'MemberInvite.showId contains NULL values. Please backfill before running this migration.';
  END IF;
END;
$$;

ALTER TABLE "public"."MemberInvite"
ALTER COLUMN "showId" SET NOT NULL;

ALTER TABLE "public"."MemberInvite"
ADD CONSTRAINT IF NOT EXISTS "MemberInvite_showId_fkey"
FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MemberInvite_showId_idx"
ON "public"."MemberInvite"("showId");
