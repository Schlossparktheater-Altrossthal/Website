-- DropForeignKey
ALTER TABLE "FinalRehearsalDuty" DROP CONSTRAINT "FinalRehearsalDuty_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DepartmentTask" DROP CONSTRAINT "DepartmentTask_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DepartmentEvent" DROP CONSTRAINT "DepartmentEvent_createdById_fkey";

-- DropForeignKey
ALTER TABLE "RehearsalAttendanceLog" DROP CONSTRAINT "RehearsalAttendanceLog_changedById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_showId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_createdById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceBudget" DROP CONSTRAINT "FinanceBudget_showId_fkey";

-- DropForeignKey
ALTER TABLE "IssueComment" DROP CONSTRAINT "IssueComment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoConsent" DROP CONSTRAINT "PhotoConsent_showId_fkey";

-- DropForeignKey
ALTER TABLE "GalleryItem" DROP CONSTRAINT "GalleryItem_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "MemberInvite" DROP CONSTRAINT "MemberInvite_createdById_fkey";

-- AddForeignKey
ALTER TABLE "FinalRehearsalDuty" ADD CONSTRAINT "FinalRehearsalDuty_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentEvent" ADD CONSTRAINT "DepartmentEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalAttendanceLog" ADD CONSTRAINT "RehearsalAttendanceLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoConsent" ADD CONSTRAINT "PhotoConsent_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

