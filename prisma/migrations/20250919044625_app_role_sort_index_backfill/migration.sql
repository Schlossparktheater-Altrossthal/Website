DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'AppRole'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AppRole'
      AND column_name = 'sortIndex'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."AppRole" ADD COLUMN "sortIndex" INTEGER NOT NULL DEFAULT 0;';

    EXECUTE '
      UPDATE "public"."AppRole" AS r
      SET "sortIndex" = ordered.rn
      FROM (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "name" ASC) - 1 AS rn
        FROM "public"."AppRole"
        WHERE "isSystem" = false
      ) AS ordered
      WHERE r."id" = ordered."id";
    ';
  END IF;
END
$$;
