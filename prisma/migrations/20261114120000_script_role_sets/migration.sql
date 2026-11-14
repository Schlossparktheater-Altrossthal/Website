-- CreateTable
CREATE TABLE "ScriptRoleSet" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptRoleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptRoleSetMember" (
    "setId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "ScriptRoleSetMember_pkey" PRIMARY KEY ("setId","roleId")
);

-- CreateTable
CREATE TABLE "ScriptGroupSetRule" (
    "id" TEXT NOT NULL,
    "groupRoleId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "sceneKey" TEXT,
    "lineageId" TEXT,
    "mode" "ScriptGroupRuleMode" NOT NULL DEFAULT 'include',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptGroupSetRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScriptRoleSet_showId_name_key" ON "ScriptRoleSet"("showId", "name");

-- CreateIndex
CREATE INDEX "ScriptRoleSetMember_roleId_idx" ON "ScriptRoleSetMember"("roleId");

-- CreateIndex
CREATE INDEX "ScriptGroupSetRule_groupRoleId_idx" ON "ScriptGroupSetRule"("groupRoleId");

-- CreateIndex
CREATE INDEX "ScriptGroupSetRule_setId_idx" ON "ScriptGroupSetRule"("setId");

-- AddForeignKey
ALTER TABLE "ScriptRoleSet" ADD CONSTRAINT "ScriptRoleSet_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptRoleSetMember" ADD CONSTRAINT "ScriptRoleSetMember_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ScriptRoleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptRoleSetMember" ADD CONSTRAINT "ScriptRoleSetMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ScriptRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptGroupSetRule" ADD CONSTRAINT "ScriptGroupSetRule_groupRoleId_fkey" FOREIGN KEY ("groupRoleId") REFERENCES "ScriptRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptGroupSetRule" ADD CONSTRAINT "ScriptGroupSetRule_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ScriptRoleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

