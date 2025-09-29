-- CreateTable
CREATE TABLE "public"."DepartmentTaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentTaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepartmentDocument" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentTaskAssignment_taskId_userId_key" ON "public"."DepartmentTaskAssignment"("taskId", "userId");

-- CreateIndex
CREATE INDEX "DepartmentTaskAssignment_userId_idx" ON "public"."DepartmentTaskAssignment"("userId");

-- CreateIndex
CREATE INDEX "DepartmentDocument_departmentId_createdAt_idx" ON "public"."DepartmentDocument"("departmentId", "createdAt");

-- Copy existing single assignments
INSERT INTO "public"."DepartmentTaskAssignment" ("id", "taskId", "userId", "createdAt")
SELECT md5("DepartmentTask"."id" || ':' || "DepartmentTask"."assigneeId" || ':' || now()::text), "DepartmentTask"."id", "DepartmentTask"."assigneeId", COALESCE("DepartmentTask"."updatedAt", CURRENT_TIMESTAMP)
FROM "public"."DepartmentTask"
WHERE "DepartmentTask"."assigneeId" IS NOT NULL;

-- Drop old foreign key and column
ALTER TABLE "public"."DepartmentTask" DROP CONSTRAINT IF EXISTS "DepartmentTask_assigneeId_fkey";
DROP INDEX IF EXISTS "DepartmentTask_assigneeId_idx";
ALTER TABLE "public"."DepartmentTask" DROP COLUMN IF EXISTS "assigneeId";

-- Add foreign keys for new tables
ALTER TABLE "public"."DepartmentTaskAssignment" ADD CONSTRAINT "DepartmentTaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."DepartmentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DepartmentTaskAssignment" ADD CONSTRAINT "DepartmentTaskAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DepartmentDocument" ADD CONSTRAINT "DepartmentDocument_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DepartmentDocument" ADD CONSTRAINT "DepartmentDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
