
-- CreateEnum
CREATE TYPE "ScriptRoleKind" AS ENUM ('person', 'group', 'ignore');

-- CreateEnum
CREATE TYPE "ScriptGroupMode" AS ENUM ('cast', 'present', 'fixed');

-- CreateEnum
CREATE TYPE "ScriptGroupRuleMode" AS ENUM ('include', 'exclude');

-- AlterTable
ALTER TABLE "ScriptScene" ADD COLUMN     "sceneKey" TEXT;

-- Bestehende Fassungen: gleicher Szenentitel im selben Stück = gleiche Szene.
UPDATE "ScriptScene" s
SET "sceneKey" = md5(v."showId" || ':' || lower(regexp_replace(trim(s."title"), '\s+', ' ', 'g')))
FROM "ScriptVersion" v
WHERE v."id" = s."versionId";

ALTER TABLE "ScriptScene" ALTER COLUMN "sceneKey" SET NOT NULL;

-- AlterTable
ALTER TABLE "ScriptRole" ADD COLUMN     "groupMode" "ScriptGroupMode",
ADD COLUMN     "kind" "ScriptRoleKind" NOT NULL DEFAULT 'person',
ADD COLUMN     "linkedAt" TIMESTAMP(3);

-- Gruppen wie in isEnsembleRole() (src/lib/skript/casting.ts) vorbelegen; „Alle …“ = alle Besetzten.
UPDATE "ScriptRole"
SET "kind" = 'group',
    "groupMode" = CASE WHEN "name" ~* '^alle\M' THEN 'cast'::"ScriptGroupMode" ELSE 'present'::"ScriptGroupMode" END
WHERE "name" ~* '^(alle|beide|weitere|andere|der chor|die chor|chor|ensemble|gruppe|volk|menge|demonstranten|stimmen)\M'
   OR "name" ~* '\mchor\M';

-- CreateTable
CREATE TABLE "ScriptRoleLink" (
    "scriptRoleId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptRoleLink_pkey" PRIMARY KEY ("scriptRoleId","characterId")
);

-- CreateTable
CREATE TABLE "ScriptGroupRule" (
    "id" TEXT NOT NULL,
    "groupRoleId" TEXT NOT NULL,
    "memberRoleId" TEXT NOT NULL,
    "sceneKey" TEXT,
    "lineageId" TEXT,
    "mode" "ScriptGroupRuleMode" NOT NULL DEFAULT 'include',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptGroupRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptRoleMerge" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "targetRoleId" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "blockIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "learnCardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "ScriptRoleMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScriptRoleLink_characterId_idx" ON "ScriptRoleLink"("characterId");

-- CreateIndex
CREATE INDEX "ScriptGroupRule_groupRoleId_idx" ON "ScriptGroupRule"("groupRoleId");

-- CreateIndex
CREATE INDEX "ScriptGroupRule_memberRoleId_idx" ON "ScriptGroupRule"("memberRoleId");

-- CreateIndex
CREATE INDEX "ScriptRoleMerge_showId_createdAt_idx" ON "ScriptRoleMerge"("showId", "createdAt");

-- AddForeignKey
ALTER TABLE "ScriptRoleLink" ADD CONSTRAINT "ScriptRoleLink_scriptRoleId_fkey" FOREIGN KEY ("scriptRoleId") REFERENCES "ScriptRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptRoleLink" ADD CONSTRAINT "ScriptRoleLink_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptGroupRule" ADD CONSTRAINT "ScriptGroupRule_groupRoleId_fkey" FOREIGN KEY ("groupRoleId") REFERENCES "ScriptRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptGroupRule" ADD CONSTRAINT "ScriptGroupRule_memberRoleId_fkey" FOREIGN KEY ("memberRoleId") REFERENCES "ScriptRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptRoleMerge" ADD CONSTRAINT "ScriptRoleMerge_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

