-- CreateTable
CREATE TABLE "public"."DepartmentPermission" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "DepartmentPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentPermission_departmentId_permissionId_key"
  ON "public"."DepartmentPermission"("departmentId", "permissionId");

-- AddForeignKey
ALTER TABLE "public"."DepartmentPermission"
  ADD CONSTRAINT "DepartmentPermission_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."DepartmentPermission"
  ADD CONSTRAINT "DepartmentPermission_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
