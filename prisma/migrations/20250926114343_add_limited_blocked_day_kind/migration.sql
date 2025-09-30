DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'BlockedDayKind'
          AND e.enumlabel = 'LIMITED'
    ) THEN
        ALTER TYPE "public"."BlockedDayKind" ADD VALUE 'LIMITED';
    END IF;
END $$;
