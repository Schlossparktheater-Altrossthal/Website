-- AlterEnum
DO $$
BEGIN
  ALTER TYPE "public"."AttendanceStatus" ADD VALUE 'maybe';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
