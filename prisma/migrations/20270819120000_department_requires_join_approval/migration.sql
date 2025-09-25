-- AlterTable
ALTER TABLE "public"."Department"
ADD COLUMN "requiresJoinApproval" BOOLEAN NOT NULL DEFAULT false;
