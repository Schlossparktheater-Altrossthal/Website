-- CreateEnum
CREATE TYPE "DirectionWishTargetKind" AS ENUM ('planning', 'department', 'character', 'user');
-- CreateEnum
CREATE TYPE "DirectionWishTargetStatus" AS ENUM ('open', 'accepted', 'planned', 'done', 'declined');
-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";
-- AlterTable
ALTER TABLE "DirectionWishMessage" ADD COLUMN     "targetLabel" TEXT,
ADD COLUMN     "targetStatus" "DirectionWishTargetStatus";
-- DropTable
DROP TABLE "Task";
-- CreateTable
CREATE TABLE "DirectionWishTarget" (
    "id" TEXT NOT NULL,
    "wishId" TEXT NOT NULL,
    "kind" "DirectionWishTargetKind" NOT NULL,
    "departmentId" TEXT,
    "characterId" TEXT,
    "userId" TEXT,
    "status" "DirectionWishTargetStatus" NOT NULL DEFAULT 'open',
    "reason" TEXT,
    "statusAt" TIMESTAMP(3),
    "statusById" TEXT,
    "departmentTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectionWishTarget_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "DirectionWishScene" (
    "wishId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    CONSTRAINT "DirectionWishScene_pkey" PRIMARY KEY ("wishId","sceneId")
);
-- CreateTable
CREATE TABLE "DirectionWishPerson" (
    "wishId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DirectionWishPerson_pkey" PRIMARY KEY ("wishId","userId")
);
-- Bestehende Wünsche gingen an die Planung: Empfänger „Planung“ mit bisherigem Status.
INSERT INTO "DirectionWishTarget" ("id", "wishId", "kind", "status", "statusAt", "createdAt")
SELECT 'dwt_' || "id", "id", 'planning', "status"::text::"DirectionWishTargetStatus", "statusAt", "createdAt"
FROM "DirectionWish";

-- Szenen und Personen aus den bisherigen ID-Listen übernehmen (nur noch vorhandene).
INSERT INTO "DirectionWishScene" ("wishId", "sceneId")
SELECT DISTINCT w."id", s."id"
FROM "DirectionWish" w
CROSS JOIN LATERAL unnest(w."sceneIds") AS ref("sceneId")
JOIN "Scene" s ON s."id" = ref."sceneId";

INSERT INTO "DirectionWishPerson" ("wishId", "userId")
SELECT DISTINCT w."id", u."id"
FROM "DirectionWish" w
CROSS JOIN LATERAL unnest(w."userIds") AS ref("userId")
JOIN "User" u ON u."id" = ref."userId";

ALTER TABLE "DirectionWish" DROP COLUMN "sceneIds",
DROP COLUMN "userIds";

-- CreateIndex
CREATE UNIQUE INDEX "DirectionWishTarget_departmentTaskId_key" ON "DirectionWishTarget"("departmentTaskId");
-- CreateIndex
CREATE INDEX "DirectionWishTarget_wishId_idx" ON "DirectionWishTarget"("wishId");
-- CreateIndex
CREATE INDEX "DirectionWishTarget_departmentId_idx" ON "DirectionWishTarget"("departmentId");
-- CreateIndex
CREATE INDEX "DirectionWishTarget_characterId_idx" ON "DirectionWishTarget"("characterId");
-- CreateIndex
CREATE INDEX "DirectionWishTarget_userId_idx" ON "DirectionWishTarget"("userId");
-- CreateIndex
CREATE INDEX "DirectionWishScene_sceneId_idx" ON "DirectionWishScene"("sceneId");
-- CreateIndex
CREATE INDEX "DirectionWishPerson_userId_idx" ON "DirectionWishPerson"("userId");
-- AddForeignKey
ALTER TABLE "DirectionWishTarget" ADD CONSTRAINT "DirectionWishTarget_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "DirectionWish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishTarget" ADD CONSTRAINT "DirectionWishTarget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishTarget" ADD CONSTRAINT "DirectionWishTarget_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishTarget" ADD CONSTRAINT "DirectionWishTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishTarget" ADD CONSTRAINT "DirectionWishTarget_statusById_fkey" FOREIGN KEY ("statusById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishTarget" ADD CONSTRAINT "DirectionWishTarget_departmentTaskId_fkey" FOREIGN KEY ("departmentTaskId") REFERENCES "DepartmentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishScene" ADD CONSTRAINT "DirectionWishScene_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "DirectionWish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishScene" ADD CONSTRAINT "DirectionWishScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishPerson" ADD CONSTRAINT "DirectionWishPerson_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "DirectionWish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DirectionWishPerson" ADD CONSTRAINT "DirectionWishPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

