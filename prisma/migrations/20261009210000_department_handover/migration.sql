-- CreateEnum
CREATE TYPE "HandoverPushScope" AS ENUM ('none', 'leads', 'all');

-- CreateEnum
CREATE TYPE "DepartmentEditorScope" AS ENUM ('all', 'leads');

-- CreateEnum
CREATE TYPE "TaskActivityType" AS ENUM ('created', 'column', 'status', 'checklist_added', 'checklist_done', 'checklist_undone', 'comment', 'next_step', 'caution', 'claim', 'photo', 'source');

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "handoverPush" "HandoverPushScope" NOT NULL DEFAULT 'leads',
ADD COLUMN     "noteEditors" "DepartmentEditorScope" NOT NULL DEFAULT 'all';

-- AlterTable
ALTER TABLE "DepartmentTask" ADD COLUMN     "caution" TEXT,
ADD COLUMN     "cautionAt" TIMESTAMP(3),
ADD COLUMN     "cautionById" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedById" TEXT,
ADD COLUMN     "nextStep" TEXT,
ADD COLUMN     "nextStepAt" TIMESTAMP(3),
ADD COLUMN     "nextStepById" TEXT;

-- AlterTable
ALTER TABLE "TaskChecklistItem" ADD COLUMN     "doneById" TEXT;

-- CreateTable
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "taskId" TEXT,
    "objectId" TEXT,
    "actorId" TEXT,
    "type" "TaskActivityType" NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentNotice" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "DepartmentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentHandover" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "authorId" TEXT,
    "summary" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentVisit" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "previousAt" TIMESTAMP(3),

    CONSTRAINT "DepartmentVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskActivity_departmentId_createdAt_idx" ON "TaskActivity"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_createdAt_idx" ON "TaskActivity"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivity_objectId_createdAt_idx" ON "TaskActivity"("objectId", "createdAt");

-- CreateIndex
CREATE INDEX "DepartmentNotice_departmentId_resolvedAt_idx" ON "DepartmentNotice"("departmentId", "resolvedAt");

-- CreateIndex
CREATE INDEX "DepartmentHandover_departmentId_createdAt_idx" ON "DepartmentHandover"("departmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentVisit_departmentId_userId_key" ON "DepartmentVisit"("departmentId", "userId");

-- AddForeignKey
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_nextStepById_fkey" FOREIGN KEY ("nextStepById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_cautionById_fkey" FOREIGN KEY ("cautionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "DepartmentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ProductionObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentNotice" ADD CONSTRAINT "DepartmentNotice_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentNotice" ADD CONSTRAINT "DepartmentNotice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentNotice" ADD CONSTRAINT "DepartmentNotice_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentHandover" ADD CONSTRAINT "DepartmentHandover_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentHandover" ADD CONSTRAINT "DepartmentHandover_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentVisit" ADD CONSTRAINT "DepartmentVisit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentVisit" ADD CONSTRAINT "DepartmentVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
