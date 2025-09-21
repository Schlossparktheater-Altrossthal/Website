ALTER TABLE "public"."AppRole"
  ADD COLUMN "sortIndex" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "name" ASC) - 1 AS rn
  FROM "public"."AppRole"
  WHERE "isSystem" = false
)
UPDATE "public"."AppRole" AS r
SET "sortIndex" = ordered.rn
FROM ordered
WHERE r."id" = ordered."id";
