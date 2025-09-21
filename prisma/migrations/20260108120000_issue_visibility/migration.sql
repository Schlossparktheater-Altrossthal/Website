-- CreateEnum
CREATE TYPE "public"."IssueVisibility" AS ENUM ('public', 'private');

-- AlterTable
ALTER TABLE "public"."Issue"
ADD COLUMN     "visibility" "public"."IssueVisibility" NOT NULL DEFAULT 'public';

-- CreateIndex
CREATE INDEX "Issue_visibility_idx" ON "public"."Issue"("visibility");
