-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('planning', 'active', 'finished', 'archived');
CREATE TYPE "ProductionMembershipStatus" AS ENUM ('invited', 'onboarding', 'active', 'left');

-- AlterTable
ALTER TABLE "Show"
ADD COLUMN "status" "ProductionStatus" NOT NULL DEFAULT 'planning',
ADD COLUMN "statusChangedAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "ProductionMembership"
ADD COLUMN "status" "ProductionMembershipStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[],
ADD COLUMN "function" TEXT;

-- CreateIndex
CREATE INDEX "ProductionMembership_showId_status_idx" ON "ProductionMembership"("showId", "status");

-- Data: Bisher gab es genau eine Produktion ("Die unendliche Geschichte"). Existiert genau
-- eine Produktion, wird sie aktiv, bekommt alle noch aktiven Mitglieder und deren
-- produktionsbezogene Rollen (cast, tech). Bei mehreren Produktionen bleibt alles
-- 'planning' und muss in der Produktionsverwaltung gesetzt werden.
UPDATE "ProductionMembership" SET "status" = 'left' WHERE "leftAt" IS NOT NULL AND "leftAt" <= NOW();

DO $$
DECLARE
  only_show TEXT;
BEGIN
  IF (SELECT COUNT(*) FROM "Show") = 1 THEN
    SELECT "id" INTO only_show FROM "Show" LIMIT 1;

    UPDATE "Show" SET "status" = 'active', "statusChangedAt" = NOW() WHERE "id" = only_show;

    INSERT INTO "ProductionMembership" ("id", "showId", "userId", "joinedAt", "status")
    SELECT 'pm_' || md5(u."id" || only_show), only_show, u."id", u."createdAt", 'active'
    FROM "User" u
    WHERE u."deactivatedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ProductionMembership" pm
        WHERE pm."userId" = u."id" AND pm."showId" = only_show
      );

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
    WHERE pm."showId" = only_show;
  END IF;
END $$;
