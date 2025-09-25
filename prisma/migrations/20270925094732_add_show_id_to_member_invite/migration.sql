-- Add showId column to MemberInvite and backfill existing rows when possible
ALTER TABLE "public"."MemberInvite"
ADD COLUMN IF NOT EXISTS "showId" TEXT;

-- Prefer using onboarding profiles because they already store the historical show relation
WITH invite_profile AS (
  SELECT DISTINCT ON (mop."inviteId")
    mop."inviteId",
    mop."showId"
  FROM "public"."MemberOnboardingProfile" AS mop
  WHERE mop."inviteId" IS NOT NULL AND mop."showId" IS NOT NULL
  ORDER BY mop."inviteId", mop."updatedAt" DESC
)
UPDATE "public"."MemberInvite" AS mi
SET "showId" = ip."showId"
FROM invite_profile AS ip
WHERE mi."id" = ip."inviteId" AND mi."showId" IS NULL;

-- Fallback to the most recent show for invites that are not linked to onboarding data
-- If no show exists yet, create a placeholder record so we always have
-- something to reference. The migration only inserts this when the table
-- is currently empty, which is the case for fresh production databases
-- that only relied on invites so far.
DO $$
DECLARE
  placeholder_show_id CONSTANT TEXT := 'legacy-member-invite-show';
  placeholder_year    INTEGER;
  earliest_invite     TIMESTAMP;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "public"."Show") AND EXISTS (SELECT 1 FROM "public"."MemberInvite") THEN
    SELECT MIN("createdAt") INTO earliest_invite FROM "public"."MemberInvite";
    placeholder_year := COALESCE(
      CAST(EXTRACT(YEAR FROM earliest_invite) AS INTEGER),
      CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INTEGER)
    );

    INSERT INTO "public"."Show" ("id", "year", "title", "synopsis", "dates", "posterUrl", "revealedAt", "finalRehearsalWeekStart", "meta")
    VALUES (
      placeholder_show_id,
      placeholder_year,
      'Legacy-Mitgliedschaften',
      'Automatisch erstellte Produktion für bestehende Einladungen ohne Show-Verknüpfung.',
      '[]'::jsonb,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('generatedByMigration', '20270925094732_add_show_id_to_member_invite')
    )
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END;
$$;

-- Fallback to the most recent show for invites that are not linked to onboarding data
DO $$
DECLARE
  fallback_show_id TEXT;
BEGIN
  SELECT "id"
  INTO fallback_show_id
  FROM "public"."Show"
  ORDER BY "revealedAt" DESC NULLS LAST, "year" DESC, "id" DESC
  LIMIT 1;

  IF fallback_show_id IS NOT NULL THEN
    UPDATE "public"."MemberInvite"
    SET "showId" = fallback_show_id
    WHERE "showId" IS NULL;
  END IF;
END;
$$;

-- Ensure no dangling NULLs remain before adding the constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."MemberInvite" WHERE "showId" IS NULL) THEN
    RAISE EXCEPTION 'MemberInvite.showId contains NULL values after backfill. Please resolve them manually before running this migration.';
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
