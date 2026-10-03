-- Sets aus Artikeltypen (docs/Plan/lager-typen-projekte-plan.md, Phase 8).
-- AlterEnum
ALTER TYPE "InventoryAssetKind" ADD VALUE 'set';

-- CreateTable
CREATE TABLE "InventoryProductComponent" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryProductComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryProductComponent_componentId_idx" ON "InventoryProductComponent"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProductComponent_setId_componentId_key" ON "InventoryProductComponent"("setId", "componentId");

-- AddForeignKey
ALTER TABLE "InventoryProductComponent" ADD CONSTRAINT "InventoryProductComponent_setId_fkey" FOREIGN KEY ("setId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProductComponent" ADD CONSTRAINT "InventoryProductComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

