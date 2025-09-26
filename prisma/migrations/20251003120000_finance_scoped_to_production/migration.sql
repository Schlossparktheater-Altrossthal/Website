-- Scope finance data to productions

-- Ensure nullable finance records adopt the newest production
WITH latest_show AS (
  SELECT "id"
  FROM "Show"
  ORDER BY "year" DESC NULLS LAST, "id" DESC
  LIMIT 1
)
UPDATE "FinanceEntry" AS fe
SET "showId" = ls."id"
FROM latest_show AS ls
WHERE fe."showId" IS NULL
  AND ls."id" IS NOT NULL;

WITH latest_show AS (
  SELECT "id"
  FROM "Show"
  ORDER BY "year" DESC NULLS LAST, "id" DESC
  LIMIT 1
)
UPDATE "FinanceBudget" AS fb
SET "showId" = ls."id"
FROM latest_show AS ls
WHERE fb."showId" IS NULL
  AND ls."id" IS NOT NULL;

-- Abort if there are still orphaned finance records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FinanceEntry" WHERE "showId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on "FinanceEntry"."showId" while null values remain. Please assign productions.';
  END IF;
  IF EXISTS (SELECT 1 FROM "FinanceBudget" WHERE "showId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on "FinanceBudget"."showId" while null values remain. Please assign productions.';
  END IF;
END;
$$;

-- Strengthen foreign keys to cascade with productions
ALTER TABLE "FinanceEntry" DROP CONSTRAINT IF EXISTS "FinanceEntry_showId_fkey";
ALTER TABLE "FinanceBudget" DROP CONSTRAINT IF EXISTS "FinanceBudget_showId_fkey";

ALTER TABLE "FinanceEntry"
  ALTER COLUMN "showId" SET NOT NULL;
ALTER TABLE "FinanceBudget"
  ALTER COLUMN "showId" SET NOT NULL;

ALTER TABLE "FinanceEntry"
  ADD CONSTRAINT "FinanceEntry_showId_fkey"
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceBudget"
  ADD CONSTRAINT "FinanceBudget_showId_fkey"
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
