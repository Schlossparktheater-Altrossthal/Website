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

-- If an invite resulted in a membership, use that production membership as the source of truth
WITH redemption_membership AS (
  SELECT DISTINCT ON (mir."inviteId")
    mir."inviteId",
    pm."showId"
  FROM "public"."MemberInviteRedemption" AS mir
  JOIN "public"."ProductionMembership" AS pm
    ON pm."userId" = mir."userId"
  WHERE mir."userId" IS NOT NULL
    AND pm."showId" IS NOT NULL
  ORDER BY mir."inviteId", pm."joinedAt" DESC NULLS LAST, pm."showId" DESC
)
UPDATE "public"."MemberInvite" AS mi
SET "showId" = rm."showId"
FROM redemption_membership AS rm
WHERE mi."id" = rm."inviteId" AND mi."showId" IS NULL;

-- Fallback to the most recent show for invites that are not linked to onboarding or memberships
WITH fallback AS (
  SELECT "id"
  FROM "public"."Show"
  ORDER BY "revealedAt" DESC NULLS LAST, "year" DESC, "id" DESC
  LIMIT 1
)
UPDATE "public"."MemberInvite" AS mi
SET "showId" = fallback."id"
FROM fallback
WHERE mi."showId" IS NULL AND fallback."id" IS NOT NULL;

-- Ensure legacy invites without a matching show always receive a deterministic placeholder show
DO $$
DECLARE
  placeholder_show_id CONSTANT TEXT := 'legacy-member-invite-show';
  placeholder_year    INTEGER;
  earliest_invite     TIMESTAMP;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."MemberInvite" AS mi
    WHERE mi."showId" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM "public"."Show" AS s WHERE s."id" = mi."showId"
       )
  ) THEN
    SELECT MIN("createdAt") INTO earliest_invite FROM "public"."MemberInvite";
    placeholder_year := COALESCE(
      CAST(EXTRACT(YEAR FROM earliest_invite) AS INTEGER),
      CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INTEGER)
    );

    INSERT INTO "public"."Show" (
      "id",
      "year",
      "title",
      "synopsis",
      "dates",
      "posterUrl",
      "revealedAt",
      "finalRehearsalWeekStart",
      "meta"
    )
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

    UPDATE "public"."MemberInvite" AS mi
    SET "showId" = placeholder_show_id
    WHERE mi."showId" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM "public"."Show" AS s WHERE s."id" = mi."showId"
       );
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
