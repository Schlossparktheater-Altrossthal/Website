-- CreateEnum
CREATE TYPE "DepartmentPermissionMode" AS ENUM ('grant', 'revoke');

-- AlterTable
ALTER TABLE "DepartmentPermission" ADD COLUMN     "mode" "DepartmentPermissionMode" NOT NULL DEFAULT 'grant';

-- AlterTable
ALTER TABLE "DepartmentTemplate" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY['board', 'events', 'files']::TEXT[];

-- CreateTable
CREATE TABLE "TemplatePermission" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "role" "DepartmentMembershipRole" NOT NULL,

    CONSTRAINT "TemplatePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplatePermission_permissionId_idx" ON "TemplatePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplatePermission_templateId_permissionId_role_key" ON "TemplatePermission"("templateId", "permissionId", "role");

-- AddForeignKey
ALTER TABLE "TemplatePermission" ADD CONSTRAINT "TemplatePermission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DepartmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplatePermission" ADD CONSTRAINT "TemplatePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Daten (gewerke-plan.md, Phase 8). Bestehende Gewerk-Rechte bleiben als `grant`-Abweichung
-- erhalten, die Wirkung ändert sich also nicht; Blaupausen-Rechte beginnen leer.

-- Kostüm hatte die Körpermaße fest eingebaut.
UPDATE "DepartmentTemplate" SET "modules" = ARRAY['board', 'events', 'files', 'measurements']::TEXT[]
WHERE "slug" = 'kostuem';

-- Jedes Gewerk bekommt eine Blaupause: gleicher Slug → vorhandene Blaupause, sonst neue
-- (eine je Slug, aus dem jüngsten Gewerk; nicht im Onboarding, bis jemand sie freigibt).
INSERT INTO "DepartmentTemplate"
  ("id", "slug", "name", "description", "color", "requiresJoinApproval", "sortOrder", "onboardingVisible", "updatedAt")
SELECT DISTINCT ON (d."slug")
  'tpl_' || d."id", d."slug", d."name", d."description", d."color", d."requiresJoinApproval",
  100 + d."sortOrder", false, CURRENT_TIMESTAMP
FROM "Department" d
WHERE d."templateId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "DepartmentTemplate" t WHERE t."slug" = d."slug")
ORDER BY d."slug", d."createdAt" DESC;

UPDATE "Department" d SET "templateId" = t."id"
FROM "DepartmentTemplate" t
WHERE d."templateId" IS NULL AND t."slug" = d."slug";
