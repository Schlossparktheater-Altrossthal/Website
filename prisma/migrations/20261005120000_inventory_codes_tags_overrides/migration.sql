-- Lager 3 (docs/Plan/lager-kategorien-plan.md): Codes Bereich-Typ-Exemplar ohne führende Nullen
-- (T-42-3, Mengenartikel T-42), Merkmal-Ausnahmen je Kategorie, Tags, neue Merkmaltypen.
-- Es sind noch keine Etiketten gedruckt – bestehende Codes werden neu vergeben.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryFieldType" ADD VALUE 'dimensions';
ALTER TYPE "InventoryFieldType" ADD VALUE 'measure';
ALTER TYPE "InventoryFieldType" ADD VALUE 'multiselect';
ALTER TYPE "InventoryFieldType" ADD VALUE 'date';

-- AlterTable
ALTER TABLE "InventoryAsset" ADD COLUMN     "unitNumber" INTEGER;

-- AlterTable
ALTER TABLE "InventoryProduct" ADD COLUMN     "nextUnitNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "number" INTEGER;

-- Typnummern je Bereich in Anlagereihenfolge, Exemplarnummern je Typ.
UPDATE "InventoryProduct" p SET "number" = n.rn
FROM (SELECT id, row_number() OVER (PARTITION BY "areaId" ORDER BY "createdAt", id) AS rn
      FROM "InventoryProduct") n
WHERE p.id = n.id;
ALTER TABLE "InventoryProduct" ALTER COLUMN "number" SET NOT NULL;
UPDATE "InventoryArea" a SET "nextNumber" = COALESCE(
  (SELECT max("number") FROM "InventoryProduct" p WHERE p."areaId" = a.id), 0) + 1;

UPDATE "InventoryAsset" x SET "unitNumber" = n.rn
FROM (SELECT id, row_number() OVER (PARTITION BY "productId" ORDER BY "createdAt", id) AS rn
      FROM "InventoryAsset" WHERE kind <> 'bulk') n
WHERE x.id = n.id;
UPDATE "InventoryProduct" p SET "nextUnitNumber" = COALESCE(
  (SELECT max("unitNumber") FROM "InventoryAsset" x WHERE x."productId" = p.id), 0) + 1;

-- Codes neu (erst temporär, damit sich alte und neue Codes nicht in die Quere kommen).
UPDATE "InventoryAsset" SET code = '~' || id;
UPDATE "InventoryAsset" x SET code = a.prefix || '-' || p."number"
  || CASE WHEN x."unitNumber" IS NULL THEN '' ELSE '-' || x."unitNumber" END
FROM "InventoryProduct" p, "InventoryArea" a
WHERE p.id = x."productId" AND a.id = x."areaId";
UPDATE "InventoryLocation" SET code = 'L-' || (split_part(code, '-', 2))::int
WHERE code ~ '^L-[0-9]+$';

-- CreateTable
CREATE TABLE "InventoryCategoryFieldOverride" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN,

    CONSTRAINT "InventoryCategoryFieldOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InventoryProductToInventoryTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InventoryProductToInventoryTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategoryFieldOverride_categoryId_key_key" ON "InventoryCategoryFieldOverride"("categoryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTag_name_key" ON "InventoryTag"("name");

-- CreateIndex
CREATE INDEX "_InventoryProductToInventoryTag_B_index" ON "_InventoryProductToInventoryTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_areaId_number_key" ON "InventoryProduct"("areaId", "number");

-- AddForeignKey
ALTER TABLE "InventoryCategoryFieldOverride" ADD CONSTRAINT "InventoryCategoryFieldOverride_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InventoryProductToInventoryTag" ADD CONSTRAINT "_InventoryProductToInventoryTag_A_fkey" FOREIGN KEY ("A") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InventoryProductToInventoryTag" ADD CONSTRAINT "_InventoryProductToInventoryTag_B_fkey" FOREIGN KEY ("B") REFERENCES "InventoryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

