/*
  Warnings:

  - The values [maybe] on the enum `AttendanceStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AttendanceStatus_new" AS ENUM ('yes', 'no');
ALTER TABLE "public"."RehearsalAttendance" ALTER COLUMN "status" TYPE "public"."AttendanceStatus_new" USING ("status"::text::"public"."AttendanceStatus_new");
ALTER TABLE "public"."RehearsalAttendanceLog" ALTER COLUMN "previous" TYPE "public"."AttendanceStatus_new" USING ("previous"::text::"public"."AttendanceStatus_new");
ALTER TABLE "public"."RehearsalAttendanceLog" ALTER COLUMN "next" TYPE "public"."AttendanceStatus_new" USING ("next"::text::"public"."AttendanceStatus_new");
ALTER TYPE "public"."AttendanceStatus" RENAME TO "AttendanceStatus_old";
ALTER TYPE "public"."AttendanceStatus_new" RENAME TO "AttendanceStatus";
DROP TYPE "public"."AttendanceStatus_old";
COMMIT;
