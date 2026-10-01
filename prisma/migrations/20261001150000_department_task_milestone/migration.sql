-- AlterTable
ALTER TABLE "DepartmentTask" ADD COLUMN     "milestoneId" TEXT;

-- CreateIndex
CREATE INDEX "DepartmentTask_milestoneId_idx" ON "DepartmentTask"("milestoneId");

-- AddForeignKey
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ShowMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

