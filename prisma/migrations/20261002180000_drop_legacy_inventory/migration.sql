-- Das frühere Offline-Inventar hatte keine Oberfläche und keine nützlichen Daten.
DELETE FROM "SyncEvent" WHERE "scope" = 'inventory';
DELETE FROM "SyncMutation" WHERE "scope" = 'inventory';

-- AlterEnum
BEGIN;
CREATE TYPE "SyncScope_new" AS ENUM ('tickets');
ALTER TABLE "SyncEvent" ALTER COLUMN "scope" TYPE "SyncScope_new" USING ("scope"::text::"SyncScope_new");
ALTER TABLE "SyncMutation" ALTER COLUMN "scope" TYPE "SyncScope_new" USING ("scope"::text::"SyncScope_new");
ALTER TYPE "SyncScope" RENAME TO "SyncScope_old";
ALTER TYPE "SyncScope_new" RENAME TO "SyncScope";
DROP TYPE "public"."SyncScope_old";
COMMIT;

-- DropTable
DROP TABLE "InventoryItem";

-- DropEnum
DROP TYPE "InventoryItemCategory";

