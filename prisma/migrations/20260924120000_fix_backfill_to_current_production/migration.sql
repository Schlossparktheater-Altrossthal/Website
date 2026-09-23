-- Korrektur: Die Backfills vom 2026-09-23 gingen von genau einer Produktion aus. Mit einer
-- zweiten Produktion ("???", 2027) wurde keine Produktion aktiv, die Fotoerlaubnisse landeten
-- bei der jüngsten statt bei "Die unendliche Geschichte", und Bestandsmitglieder bekamen keine
-- Mitgliedschaft. Alle Bestandsdaten gehören zu "Die unendliche Geschichte".
DO $$
DECLARE
  target TEXT;
  target_status "ProductionStatus";
  target_end TIMESTAMP(3);
  consent_cutoff TIMESTAMPTZ;
BEGIN
  SELECT "id", "status", COALESCE("statusChangedAt", NOW())
    INTO target, target_status, target_end
  FROM "Show"
  WHERE "title" = 'Die unendliche Geschichte'
  ORDER BY "year" DESC
  LIMIT 1;

  IF target IS NULL THEN
    RETURN;
  END IF;

  -- 1. Fotoerlaubnisse aus der Migration (vor deren Abschluss angelegt) umhängen.
  SELECT "finished_at" INTO consent_cutoff
  FROM "_prisma_migrations"
  WHERE "migration_name" = '20260923140000_photo_consent_per_production';

  UPDATE "PhotoConsent" pc
  SET "showId" = target
  WHERE pc."showId" <> target
    AND pc."createdAt" <= COALESCE(consent_cutoff, NOW())
    AND NOT EXISTS (
      SELECT 1 FROM "PhotoConsent" other
      WHERE other."userId" = pc."userId" AND other."showId" = target
    );

  -- 2. Ohne aktive Produktion wird "Die unendliche Geschichte" aktiv, sofern ihr Status
  --    seit der Migration nicht bewusst geändert wurde.
  IF NOT EXISTS (SELECT 1 FROM "Show" WHERE "status" = 'active')
     AND target_status = 'planning' THEN
    UPDATE "Show" SET "status" = 'active', "statusChangedAt" = NOW() WHERE "id" = target;
    target_status := 'active';
  END IF;

  -- 3. Fehlende Mitgliedschaften für aktive Nutzer anlegen (bei beendeter Produktion als
  --    ausgeschieden) und Ensemble/Technik-Rollen übernehmen.
  INSERT INTO "ProductionMembership" ("id", "showId", "userId", "joinedAt", "status", "leftAt")
  SELECT
    'pm_' || md5(u."id" || target),
    target,
    u."id",
    u."createdAt",
    CASE WHEN target_status IN ('planning', 'active') THEN 'active' ELSE 'left' END::"ProductionMembershipStatus",
    CASE WHEN target_status IN ('planning', 'active') THEN NULL ELSE target_end END
  FROM "User" u
  WHERE u."deactivatedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "ProductionMembership" pm
      WHERE pm."userId" = u."id" AND pm."showId" = target
    )
  ON CONFLICT ("showId", "userId") DO NOTHING;

  UPDATE "ProductionMembership" pm
  SET "roles" = ARRAY(
    SELECT DISTINCT r FROM (
      SELECT u."role" AS r FROM "User" u WHERE u."id" = pm."userId"
      UNION
      SELECT ur."role" FROM "UserRole" ur WHERE ur."userId" = pm."userId"
    ) src
    WHERE r IN ('cast', 'tech')
    ORDER BY r
  )
  WHERE pm."showId" = target
    AND cardinality(pm."roles") = 0;

  -- 4. Onboardings aus Profilen ohne Produktion gehören ebenfalls zu dieser Produktion.
  UPDATE "ProductionOnboarding" po
  SET "showId" = target
  FROM "MemberOnboardingProfile" p
  LEFT JOIN "MemberInvite" i ON i."id" = p."inviteId"
  WHERE po."id" = 'po_' || md5(p."id")
    AND p."showId" IS NULL
    AND i."showId" IS NULL
    AND po."showId" <> target
    AND NOT EXISTS (
      SELECT 1 FROM "ProductionOnboarding" other
      WHERE other."userId" = po."userId" AND other."showId" = target
    );
END $$;
