-- CreateTable
CREATE TABLE "public"."DepartmentEvent" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3),
    "location" TEXT,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentEvent_departmentId_start_idx" ON "public"."DepartmentEvent"("departmentId", "start");

-- AddForeignKey
ALTER TABLE "public"."DepartmentEvent" ADD CONSTRAINT "DepartmentEvent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentEvent" ADD CONSTRAINT "DepartmentEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
