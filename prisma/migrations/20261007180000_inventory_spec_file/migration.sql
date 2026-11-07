-- Lager – Datei-Anhang als Merkmalstyp (docs/Plan/lager-merkmal-typen-plan.md):
-- Metadaten `{ id, name, mime, size }` stehen in `InventoryProduct.specs`, die Bytes in der
-- neuen Tabelle `InventoryProductFile`.

-- AlterEnum
ALTER TYPE "InventoryFieldType" ADD VALUE 'file';

-- CreateTable
CREATE TABLE "InventoryProductFile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryProductFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProductFile_productId_fieldKey_key" ON "InventoryProductFile"("productId", "fieldKey");

-- CreateIndex
CREATE INDEX "InventoryProductFile_productId_idx" ON "InventoryProductFile"("productId");

-- AddForeignKey
ALTER TABLE "InventoryProductFile" ADD CONSTRAINT "InventoryProductFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
