-- Update measurement units to M/CM/MM/EU
UPDATE "MemberMeasurement"
SET "value" = "value" * 2.54,
    "unit" = 'CM'
WHERE "unit" = 'INCH';

UPDATE "MemberMeasurement"
SET "unit" = 'EU'
WHERE "unit" = 'DE';

CREATE TYPE "MeasurementUnit_new" AS ENUM ('M', 'CM', 'MM', 'EU');

ALTER TABLE "MemberMeasurement"
ALTER COLUMN "unit" TYPE "MeasurementUnit_new"
USING ("unit"::text::"MeasurementUnit_new");

ALTER TYPE "MeasurementUnit" RENAME TO "MeasurementUnit_old";
ALTER TYPE "MeasurementUnit_new" RENAME TO "MeasurementUnit";
DROP TYPE "MeasurementUnit_old";
