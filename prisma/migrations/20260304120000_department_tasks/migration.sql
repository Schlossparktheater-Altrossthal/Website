-- CreateTable
CREATE TABLE "public"."DepartmentTask" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'todo',
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentTask_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."DepartmentTask"
  ADD CONSTRAINT "DepartmentTask_departmentId_fkey"
  FOREIGN KEY ("departmentId")
  REFERENCES "public"."Department"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "public"."DepartmentTask"
  ADD CONSTRAINT "DepartmentTask_assigneeId_fkey"
  FOREIGN KEY ("assigneeId")
  REFERENCES "public"."User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "public"."DepartmentTask"
  ADD CONSTRAINT "DepartmentTask_createdById_fkey"
  FOREIGN KEY ("createdById")
  REFERENCES "public"."User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "DepartmentTask_departmentId_status_idx"
  ON "public"."DepartmentTask"("departmentId", "status");

CREATE INDEX "DepartmentTask_assigneeId_idx"
  ON "public"."DepartmentTask"("assigneeId");

CREATE INDEX "DepartmentTask_createdAt_idx"
  ON "public"."DepartmentTask"("createdAt");
