-- CreateEnum
CREATE TYPE "ProductionObjectKind" AS ENUM ('prop', 'set_piece', 'costume', 'costume_part', 'other');

-- CreateEnum
CREATE TYPE "ProductionObjectSource" AS ENUM ('undecided', 'stock', 'build', 'buy', 'borrow');

-- CreateEnum
CREATE TYPE "ProductionObjectStatus" AS ENUM ('planned', 'in_progress', 'ready');

-- CreateEnum
CREATE TYPE "SceneRequirementStatus" AS ENUM ('open', 'assigned', 'declined');

-- AlterTable
ALTER TABLE "DepartmentTask" ADD COLUMN     "objectId" TEXT;

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "objectId" TEXT;

-- CreateTable
CREATE TABLE "ProductionObject" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "kind" "ProductionObjectKind" NOT NULL DEFAULT 'prop',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" "ProductionObjectSource" NOT NULL DEFAULT 'undecided',
    "status" "ProductionObjectStatus" NOT NULL DEFAULT 'planned',
    "dimensions" TEXT,
    "material" TEXT,
    "costCents" INTEGER,
    "note" TEXT,
    "inventoryProductId" TEXT,
    "inventoryAssetId" TEXT,
    "checkedAt" TIMESTAMP(3),
    "checkedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionObjectPhoto" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'reference',
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionObjectPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectScene" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ObjectScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectCharacter" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "ObjectCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostumePart" (
    "id" TEXT NOT NULL,
    "costumeId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CostumePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneRequirement" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "kind" "ProductionObjectKind" NOT NULL DEFAULT 'prop',
    "characterId" TEXT,
    "text" TEXT NOT NULL,
    "photo" BYTEA,
    "photoMimeType" TEXT,
    "status" "SceneRequirementStatus" NOT NULL DEFAULT 'open',
    "declineReason" TEXT,
    "objectId" TEXT,
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionObject_showId_kind_idx" ON "ProductionObject"("showId", "kind");

-- CreateIndex
CREATE INDEX "ProductionObject_departmentId_idx" ON "ProductionObject"("departmentId");

-- CreateIndex
CREATE INDEX "ProductionObjectPhoto_objectId_idx" ON "ProductionObjectPhoto"("objectId");

-- CreateIndex
CREATE INDEX "ObjectScene_sceneId_idx" ON "ObjectScene"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectScene_objectId_sceneId_key" ON "ObjectScene"("objectId", "sceneId");

-- CreateIndex
CREATE INDEX "ObjectCharacter_characterId_idx" ON "ObjectCharacter"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectCharacter_objectId_characterId_key" ON "ObjectCharacter"("objectId", "characterId");

-- CreateIndex
CREATE INDEX "CostumePart_partId_idx" ON "CostumePart"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "CostumePart_costumeId_partId_key" ON "CostumePart"("costumeId", "partId");

-- CreateIndex
CREATE INDEX "SceneRequirement_departmentId_status_idx" ON "SceneRequirement"("departmentId", "status");

-- CreateIndex
CREATE INDEX "SceneRequirement_sceneId_idx" ON "SceneRequirement"("sceneId");

-- CreateIndex
CREATE INDEX "TaskChecklistItem_taskId_position_idx" ON "TaskChecklistItem"("taskId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentTask_objectId_key" ON "DepartmentTask"("objectId");

-- AddForeignKey
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ProductionObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ProductionObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionObject" ADD CONSTRAINT "ProductionObject_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionObject" ADD CONSTRAINT "ProductionObject_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionObject" ADD CONSTRAINT "ProductionObject_inventoryProductId_fkey" FOREIGN KEY ("inventoryProductId") REFERENCES "InventoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionObject" ADD CONSTRAINT "ProductionObject_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionObject" ADD CONSTRAINT "ProductionObject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionObject" ADD CONSTRAINT "ProductionObject_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionObjectPhoto" ADD CONSTRAINT "ProductionObjectPhoto_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ProductionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectScene" ADD CONSTRAINT "ObjectScene_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ProductionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectScene" ADD CONSTRAINT "ObjectScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectCharacter" ADD CONSTRAINT "ObjectCharacter_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ProductionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectCharacter" ADD CONSTRAINT "ObjectCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostumePart" ADD CONSTRAINT "CostumePart_costumeId_fkey" FOREIGN KEY ("costumeId") REFERENCES "ProductionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostumePart" ADD CONSTRAINT "CostumePart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "ProductionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneRequirement" ADD CONSTRAINT "SceneRequirement_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneRequirement" ADD CONSTRAINT "SceneRequirement_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneRequirement" ADD CONSTRAINT "SceneRequirement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneRequirement" ADD CONSTRAINT "SceneRequirement_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneRequirement" ADD CONSTRAINT "SceneRequirement_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ProductionObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneRequirement" ADD CONSTRAINT "SceneRequirement_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneRequirement" ADD CONSTRAINT "SceneRequirement_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "DepartmentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Datenübernahme (docs/Plan/ausstattung-plan.md, Phase 1): je SceneBreakdownItem ein Objekt mit
-- Szenenbezug und Board-Karte. Die alte Tabelle bleibt bis Phase 7 bestehen.
INSERT INTO "ProductionObject" ("id", "showId", "departmentId", "kind", "title", "description", "status", "note", "createdAt", "updatedAt")
SELECT 'po_' || b."id", s."showId", b."departmentId",
  (CASE WHEN t."slug" IN ('kostuem', 'kostueme') THEN 'costume' WHEN t."slug" IN ('buehnenbild', 'buehnenbau') THEN 'set_piece' ELSE 'prop' END)::"ProductionObjectKind",
  b."title", b."description",
  (CASE b."status" WHEN 'planned' THEN 'planned' WHEN 'ready' THEN 'ready' WHEN 'done' THEN 'ready' ELSE 'in_progress' END)::"ProductionObjectStatus",
  b."note", b."createdAt", b."updatedAt"
FROM "SceneBreakdownItem" b
JOIN "Scene" s ON s."id" = b."sceneId"
JOIN "Department" d ON d."id" = b."departmentId"
LEFT JOIN "DepartmentTemplate" t ON t."id" = d."templateId";

INSERT INTO "ObjectScene" ("id", "objectId", "sceneId")
SELECT 'os_' || b."id", 'po_' || b."id", b."sceneId" FROM "SceneBreakdownItem" b;

INSERT INTO "DepartmentTask" ("id", "departmentId", "columnId", "position", "title", "status", "createdById", "objectId", "dueAt", "createdAt", "updatedAt")
SELECT x."id", x."departmentId",
  (SELECT c."id" FROM "DepartmentBoardColumn" c WHERE c."departmentId" = x."departmentId" AND c."status" = x."status" ORDER BY c."position" LIMIT 1),
  1000 + x."rn", x."title", x."status", x."creator", x."objectId", x."neededBy", now(), now()
FROM (
  SELECT 'dt_' || b."id" AS "id", b."departmentId", b."title", 'po_' || b."id" AS "objectId", b."neededBy",
    (CASE b."status" WHEN 'planned' THEN 'todo' WHEN 'ready' THEN 'done' WHEN 'done' THEN 'done' ELSE 'doing' END)::"TaskStatus" AS "status",
    COALESCE(
      b."assignedToId",
      (SELECT m."userId" FROM "DepartmentMembership" m WHERE m."departmentId" = b."departmentId" AND m."role" = 'lead' ORDER BY m."createdAt" LIMIT 1),
      (SELECT u."id" FROM "User" u ORDER BY u."createdAt" LIMIT 1)
    ) AS "creator",
    row_number() OVER (PARTITION BY b."departmentId" ORDER BY b."createdAt") AS "rn"
  FROM "SceneBreakdownItem" b
) x
WHERE x."creator" IS NOT NULL;

INSERT INTO "DepartmentTaskAssignment" ("id", "taskId", "userId")
SELECT 'dta_' || b."id", 'dt_' || b."id", b."assignedToId"
FROM "SceneBreakdownItem" b
WHERE b."assignedToId" IS NOT NULL AND EXISTS (SELECT 1 FROM "DepartmentTask" t WHERE t."id" = 'dt_' || b."id");

-- Bausteine: Eingang (requirements) + eigene Verwaltungsseite je Blaupause. Bühnenbau baut auch
-- die Requisiten (eigene Kaschur gibt es nicht), bekommt also beide Seiten.
UPDATE "DepartmentTemplate" SET "modules" = array_cat("modules", ARRAY['requirements', 'props'])
WHERE "slug" = 'requisite' AND NOT ('props' = ANY("modules"));
UPDATE "DepartmentTemplate" SET "modules" = array_cat("modules", ARRAY['requirements', 'costumes'])
WHERE "slug" IN ('kostuem', 'kostueme') AND NOT ('costumes' = ANY("modules"));
UPDATE "DepartmentTemplate" SET "modules" = array_cat("modules", ARRAY['requirements', 'set', 'props'])
WHERE "slug" IN ('buehnenbild', 'buehnenbau') AND NOT ('set' = ANY("modules"));
UPDATE "DepartmentTemplate" SET "modules" = ARRAY(SELECT DISTINCT unnest("modules"));

-- Neues Recht „Ausstattung anfordern“: standardmäßig Regie/Board (Produktionen verwalten),
-- Produktionsplanung und Probenplanung.
INSERT INTO "Permission" ("id", "key", "label")
VALUES ('perm_production_requirement_create', 'PRIVATE.PRODUCTION.REQUIREMENT.CREATE', 'Ausstattung anfordern')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AppRolePermission" ("id", "roleId", "permissionId")
SELECT DISTINCT 'apr_' || md5(arp."roleId" || target."id"), arp."roleId", target."id"
FROM "AppRolePermission" arp
JOIN "Permission" source ON source."id" = arp."permissionId"
  AND source."key" IN ('PRIVATE.PRODUCTION.SHOW.MANAGE', 'PRIVATE.PRODUCTION.PLAN.MANAGE', 'PRIVATE.REHEARSAL.PLANNING.MANAGE')
CROSS JOIN (SELECT "id" FROM "Permission" WHERE "key" = 'PRIVATE.PRODUCTION.REQUIREMENT.CREATE') target
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
