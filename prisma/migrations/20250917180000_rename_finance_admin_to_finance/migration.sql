-- Rename enum value 'finance_admin' to 'finance' for Role enum (PostgreSQL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'finance_admin'
  ) THEN
    ALTER TYPE "Role" RENAME VALUE 'finance_admin' TO 'finance';
  END IF;
END
$$;

