-- Gewerke pro Produktion: globale Vorlagen + Department je Show, Mitgliedschaftsstatus.

CREATE TYPE "DepartmentMembershipStatus" AS ENUM ('requested', 'active', 'left');
CREATE TYPE "DepartmentAssignmentSource" AS ENUM ('wish', 'self', 'assigned');

-- Vorlagen
CREATE TABLE "DepartmentTemplate" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "preferenceCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requiresJoinApproval" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepartmentTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DepartmentTemplate_slug_key" ON "DepartmentTemplate"("slug");

-- Bestehende Gewerke werden zu Vorlagen (Wunsch-Codes für bekannte Slugs).
INSERT INTO "DepartmentTemplate"
  ("id", "slug", "name", "description", "color", "preferenceCodes", "requiresJoinApproval", "sortOrder", "updatedAt")
SELECT
  'tpl_' || d."id", d."slug", d."name", d."description", d."color",
  CASE d."slug"
    WHEN 'buehnenbild' THEN ARRAY['crew_stage']
    WHEN 'technik' THEN ARRAY['crew_tech']
    WHEN 'licht' THEN ARRAY['crew_tech']
    WHEN 'ton' THEN ARRAY['crew_tech', 'crew_music']
    WHEN 'kostuem' THEN ARRAY['crew_costume']
    WHEN 'maske' THEN ARRAY['crew_makeup']
    WHEN 'requisite' THEN ARRAY['crew_props']
    WHEN 'werbung-social' THEN ARRAY['crew_marketing']
    ELSE ARRAY[]::TEXT[]
  END,
  d."requiresJoinApproval", 0, CURRENT_TIMESTAMP
FROM "Department" d;

-- Department: Produktion, Vorlage, Archivierung
ALTER TABLE "Department"
  ADD COLUMN "showId" TEXT,
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Department" SET "templateId" = 'tpl_' || "id";

-- Bestand gehört zur aktuellen Produktion (aktiv vor geplant vor Rest, dann neuestes Jahr).
DO $$
DECLARE target TEXT;
BEGIN
  SELECT "id" INTO target FROM "Show"
  ORDER BY ("status" = 'active') DESC, ("status" = 'planning') DESC, "year" DESC, "id" DESC
  LIMIT 1;
  IF target IS NULL THEN
    IF EXISTS (SELECT 1 FROM "Department") THEN
      RAISE EXCEPTION 'Gewerke vorhanden, aber keine Produktion zum Zuordnen';
    END IF;
  ELSE
    UPDATE "Department" SET "showId" = target;
  END IF;
END $$;

ALTER TABLE "Department" ALTER COLUMN "showId" SET NOT NULL;
DROP INDEX "Department_slug_key";
CREATE UNIQUE INDEX "Department_showId_slug_key" ON "Department"("showId", "slug");
CREATE INDEX "Department_templateId_idx" ON "Department"("templateId");
ALTER TABLE "Department" ADD CONSTRAINT "Department_showId_fkey"
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DepartmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mitgliedschaft: Status, Herkunft, Entscheidung
ALTER TABLE "DepartmentMembership"
  ADD COLUMN "status" "DepartmentMembershipStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "source" "DepartmentAssignmentSource" NOT NULL DEFAULT 'assigned',
  ADD COLUMN "assignedById" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3);
UPDATE "DepartmentMembership" SET "decidedAt" = "createdAt";
CREATE INDEX "DepartmentMembership_userId_status_idx" ON "DepartmentMembership"("userId", "status");
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
