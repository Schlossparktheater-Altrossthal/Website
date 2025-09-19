-- CreateEnum
CREATE TYPE "public"."DepartmentMembershipRole" AS ENUM ('lead', 'member', 'deputy', 'guest');

-- CreateEnum
CREATE TYPE "public"."CharacterCastingType" AS ENUM ('primary', 'alternate', 'cover', 'cameo');

-- CreateEnum
CREATE TYPE "public"."BreakdownStatus" AS ENUM ('planned', 'in_progress', 'blocked', 'ready', 'done');

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isCore" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepartmentMembership" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."DepartmentMembershipRole" NOT NULL DEFAULT 'member',
    "title" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Character" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CharacterCasting" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."CharacterCastingType" NOT NULL DEFAULT 'primary',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterCasting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Scene" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "identifier" TEXT,
    "title" TEXT,
    "slug" TEXT,
    "summary" TEXT,
    "location" TEXT,
    "timeOfDay" TEXT,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SceneCharacter" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SceneCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SceneBreakdownItem" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."BreakdownStatus" NOT NULL DEFAULT 'planned',
    "neededBy" TIMESTAMP(3),
    "note" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneBreakdownItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_slug_key" ON "public"."Department"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_departmentId_userId_key" ON "public"."DepartmentMembership"("departmentId", "userId");

-- CreateIndex
CREATE INDEX "Character_showId_order_idx" ON "public"."Character"("showId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterCasting_characterId_userId_type_key" ON "public"."CharacterCasting"("characterId", "userId", "type");

-- CreateIndex
CREATE INDEX "Scene_showId_sequence_idx" ON "public"."Scene"("showId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_showId_slug_key" ON "public"."Scene"("showId", "slug");

-- CreateIndex
CREATE INDEX "SceneCharacter_characterId_idx" ON "public"."SceneCharacter"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneCharacter_sceneId_characterId_key" ON "public"."SceneCharacter"("sceneId", "characterId");

-- CreateIndex
CREATE INDEX "SceneBreakdownItem_sceneId_departmentId_idx" ON "public"."SceneBreakdownItem"("sceneId", "departmentId");

-- AddForeignKey
ALTER TABLE "public"."DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Character" ADD CONSTRAINT "Character_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterCasting" ADD CONSTRAINT "CharacterCasting_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterCasting" ADD CONSTRAINT "CharacterCasting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scene" ADD CONSTRAINT "Scene_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneCharacter" ADD CONSTRAINT "SceneCharacter_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "public"."Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneCharacter" ADD CONSTRAINT "SceneCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneBreakdownItem" ADD CONSTRAINT "SceneBreakdownItem_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "public"."Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneBreakdownItem" ADD CONSTRAINT "SceneBreakdownItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneBreakdownItem" ADD CONSTRAINT "SceneBreakdownItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
