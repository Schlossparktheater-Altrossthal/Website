-- AlterTable
ALTER TABLE "public"."InventoryItem"
    ADD COLUMN "manufacturer" TEXT,
    ADD COLUMN "itemType" TEXT,
    ADD COLUMN "acquisitionCost" DOUBLE PRECISION,
    ADD COLUMN "totalValue" DOUBLE PRECISION,
    ADD COLUMN "purchaseDate" TIMESTAMP(3);
