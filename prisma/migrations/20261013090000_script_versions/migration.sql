-- CreateEnum
CREATE TYPE "ScriptVersionStatus" AS ENUM ('draft', 'released');

-- CreateEnum
CREATE TYPE "ScriptBlockKind" AS ENUM ('speech', 'direction');

-- CreateTable
CREATE TABLE "ScriptVersion" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "versionDate" TIMESTAMP(3),
    "status" "ScriptVersionStatus" NOT NULL DEFAULT 'draft',
    "sourceBucket" TEXT,
    "sourceKey" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceSize" INTEGER NOT NULL,
    "profileId" TEXT NOT NULL,
    "profileScore" DOUBLE PRECISION NOT NULL,
    "importReport" JSONB NOT NULL,
    "basedOnId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,

    CONSTRAINT "ScriptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptScene" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "ScriptScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptRole" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptBlock" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lineageId" TEXT NOT NULL,
    "kind" "ScriptBlockKind" NOT NULL,
    "speakerRaw" TEXT,
    "speaker" TEXT,
    "parts" JSONB NOT NULL,
    "page" INTEGER,
    "wordCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScriptBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptBlockRole" (
    "blockId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "ScriptBlockRole_pkey" PRIMARY KEY ("blockId","roleId")
);

-- CreateIndex
CREATE INDEX "ScriptVersion_showId_createdAt_idx" ON "ScriptVersion"("showId", "createdAt");

-- CreateIndex
CREATE INDEX "ScriptScene_versionId_sequence_idx" ON "ScriptScene"("versionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptRole_showId_name_key" ON "ScriptRole"("showId", "name");

-- CreateIndex
CREATE INDEX "ScriptBlock_versionId_sequence_idx" ON "ScriptBlock"("versionId", "sequence");

-- CreateIndex
CREATE INDEX "ScriptBlock_lineageId_idx" ON "ScriptBlock"("lineageId");

-- CreateIndex
CREATE INDEX "ScriptBlockRole_roleId_idx" ON "ScriptBlockRole"("roleId");

-- AddForeignKey
ALTER TABLE "ScriptVersion" ADD CONSTRAINT "ScriptVersion_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptVersion" ADD CONSTRAINT "ScriptVersion_basedOnId_fkey" FOREIGN KEY ("basedOnId") REFERENCES "ScriptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptVersion" ADD CONSTRAINT "ScriptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptVersion" ADD CONSTRAINT "ScriptVersion_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptScene" ADD CONSTRAINT "ScriptScene_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScriptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptRole" ADD CONSTRAINT "ScriptRole_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptRole" ADD CONSTRAINT "ScriptRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptBlock" ADD CONSTRAINT "ScriptBlock_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScriptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptBlock" ADD CONSTRAINT "ScriptBlock_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ScriptScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptBlockRole" ADD CONSTRAINT "ScriptBlockRole_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ScriptBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptBlockRole" ADD CONSTRAINT "ScriptBlockRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ScriptRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rechte (docs/Plan/skript-plan.md): Lesen bekommt jedes Mitglied (Entscheidung O1),
-- Verwalten jede Rolle, die bisher Produktionen verwaltet (Regie/Board).
INSERT INTO "Permission" ("id", "key", "label")
VALUES
  ('perm_production_script_read', 'PRIVATE.PRODUCTION.SCRIPT.READ', 'Skript lesen'),
  ('perm_production_script_manage', 'PRIVATE.PRODUCTION.SCRIPT.MANAGE', 'Skript verwalten')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AppRolePermission" ("id", "roleId", "permissionId")
SELECT 'apr_' || md5(role."id" || target."id"), role."id", target."id"
FROM "AppRole" role
CROSS JOIN (SELECT "id" FROM "Permission" WHERE "key" = 'PRIVATE.PRODUCTION.SCRIPT.READ') target
WHERE role."systemRole" = 'member'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "AppRolePermission" ("id", "roleId", "permissionId")
SELECT 'apr_' || md5(arp."roleId" || target."id"), arp."roleId", target."id"
FROM "AppRolePermission" arp
JOIN "Permission" source ON source."id" = arp."permissionId" AND source."key" = 'PRIVATE.PRODUCTION.SHOW.MANAGE'
CROSS JOIN (SELECT "id" FROM "Permission" WHERE "key" = 'PRIVATE.PRODUCTION.SCRIPT.MANAGE') target
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
