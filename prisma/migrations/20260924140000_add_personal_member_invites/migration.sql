-- AlterTable
ALTER TABLE "MemberInvite" ADD COLUMN "personalForUserId" TEXT;

-- CreateIndex
CREATE INDEX "MemberInvite_personalForUserId_idx" ON "MemberInvite"("personalForUserId");

-- AddForeignKey
ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_personalForUserId_fkey" FOREIGN KEY ("personalForUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
