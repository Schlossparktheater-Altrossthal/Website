-- CreateEnum
CREATE TYPE "InventoryItemCategory" AS ENUM (
    'light',
    'sound',
    'network',
    'video',
    'instruments',
    'cables',
    'cases',
    'accessories'
);

-- AlterTable
ALTER TABLE "public"."InventoryItem"
    ADD COLUMN "sku" TEXT,
    ADD COLUMN "category" "InventoryItemCategory" NOT NULL DEFAULT 'accessories',
    ADD COLUMN "details" TEXT,
    ADD COLUMN "lastUsedAt" TIMESTAMP(3),
    ADD COLUMN "lastInventoryAt" TIMESTAMP(3),
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill SKU for existing rows
UPDATE "public"."InventoryItem"
SET "sku" = CONCAT('INV-', SUBSTRING(md5(random()::text || clock_timestamp()::text), 1, 12))
WHERE "sku" IS NULL;

-- Ensure SKU is not null
ALTER TABLE "public"."InventoryItem"
    ALTER COLUMN "sku" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "public"."InventoryItem"("sku");

-- Trigger updatedAt on update
CREATE OR REPLACE FUNCTION "public"."set_inventory_item_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "InventoryItem_updatedAt" ON "public"."InventoryItem";
CREATE TRIGGER "InventoryItem_updatedAt"
BEFORE UPDATE ON "public"."InventoryItem"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_inventory_item_updated_at"();
