-- CreateEnum
CREATE TYPE "InventoryAssetKind" AS ENUM ('unique', 'bulk', 'container');

-- CreateEnum
CREATE TYPE "InventoryAssetStatus" AS ENUM ('available', 'checked_out', 'repair', 'locked', 'missing', 'retired');

-- CreateEnum
CREATE TYPE "InventoryCondition" AS ENUM ('new', 'good', 'used', 'worn', 'damaged');

-- CreateEnum
CREATE TYPE "InventoryDefectSeverity" AS ENUM ('cosmetic', 'limited', 'locked');

-- CreateEnum
CREATE TYPE "InventoryDefectStatus" AS ENUM ('open', 'repair', 'done');

-- CreateEnum
CREATE TYPE "InventoryInspectionResult" AS ENUM ('passed', 'failed');

-- CreateEnum
CREATE TYPE "InventoryCheckoutStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "InventoryStocktakeStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "InventoryArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "inspectionDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAsset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "categoryId" TEXT,
    "kind" "InventoryAssetKind" NOT NULL DEFAULT 'unique',
    "status" "InventoryAssetStatus" NOT NULL DEFAULT 'available',
    "condition" "InventoryCondition" NOT NULL DEFAULT 'good',
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "description" TEXT,
    "publicNote" TEXT,
    "internalNote" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "locationId" TEXT,
    "containerId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "minQuantity" INTEGER,
    "acquisitionCost" DECIMAL(10,2),
    "purchaseDate" TIMESTAMP(3),
    "supplier" TEXT,
    "ownership" TEXT,
    "inspectionRequired" BOOLEAN NOT NULL DEFAULT false,
    "inspectionIntervalMonths" INTEGER,
    "lastInspectionAt" TIMESTAMP(3),
    "nextInspectionAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "labelPrintedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "locationId" TEXT,
    "containerId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPhoto" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "defectId" TEXT,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryDefect" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "InventoryDefectSeverity" NOT NULL DEFAULT 'limited',
    "status" "InventoryDefectStatus" NOT NULL DEFAULT 'open',
    "reportedById" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryInspection" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DGUV V3',
    "result" "InventoryInspectionResult" NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL,
    "nextDueAt" TIMESTAMP(3),
    "inspectorId" TEXT,
    "inspectorName" TEXT,
    "note" TEXT,
    "documentData" BYTEA,
    "documentName" TEXT,
    "documentMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEvent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCheckout" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "showId" TEXT,
    "borrowerId" TEXT,
    "borrowerName" TEXT,
    "status" "InventoryCheckoutStatus" NOT NULL DEFAULT 'open',
    "dueAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCheckoutLine" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryCheckoutLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStocktake" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InventoryStocktakeStatus" NOT NULL DEFAULT 'open',
    "areaId" TEXT,
    "locationId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryStocktake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStocktakeScan" (
    "id" TEXT NOT NULL,
    "stocktakeId" TEXT NOT NULL,
    "clientScanId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "assetId" TEXT,
    "quantity" INTEGER,
    "locationId" TEXT,
    "containerId" TEXT,
    "userId" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryStocktakeScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryArea_prefix_key" ON "InventoryArea"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_areaId_name_key" ON "InventoryCategory"("areaId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_code_key" ON "InventoryLocation"("code");

-- CreateIndex
CREATE INDEX "InventoryLocation_parentId_idx" ON "InventoryLocation"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAsset_code_key" ON "InventoryAsset"("code");

-- CreateIndex
CREATE INDEX "InventoryAsset_areaId_idx" ON "InventoryAsset"("areaId");

-- CreateIndex
CREATE INDEX "InventoryAsset_locationId_idx" ON "InventoryAsset"("locationId");

-- CreateIndex
CREATE INDEX "InventoryAsset_containerId_idx" ON "InventoryAsset"("containerId");

-- CreateIndex
CREATE INDEX "InventoryAsset_nextInspectionAt_idx" ON "InventoryAsset"("nextInspectionAt");

-- CreateIndex
CREATE INDEX "InventoryStock_assetId_idx" ON "InventoryStock"("assetId");

-- CreateIndex
CREATE INDEX "InventoryStock_containerId_idx" ON "InventoryStock"("containerId");

-- CreateIndex
CREATE INDEX "InventoryPhoto_assetId_idx" ON "InventoryPhoto"("assetId");

-- CreateIndex
CREATE INDEX "InventoryPhoto_defectId_idx" ON "InventoryPhoto"("defectId");

-- CreateIndex
CREATE INDEX "InventoryDefect_assetId_status_idx" ON "InventoryDefect"("assetId", "status");

-- CreateIndex
CREATE INDEX "InventoryInspection_assetId_inspectedAt_idx" ON "InventoryInspection"("assetId", "inspectedAt");

-- CreateIndex
CREATE INDEX "InventoryEvent_assetId_createdAt_idx" ON "InventoryEvent"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryCheckout_status_idx" ON "InventoryCheckout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCheckoutLine_checkoutId_assetId_key" ON "InventoryCheckoutLine"("checkoutId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStocktakeScan_clientScanId_key" ON "InventoryStocktakeScan"("clientScanId");

-- CreateIndex
CREATE INDEX "InventoryStocktakeScan_stocktakeId_scannedAt_idx" ON "InventoryStocktakeScan"("stocktakeId", "scannedAt");

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "InventoryArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "InventoryArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "InventoryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "InventoryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPhoto" ADD CONSTRAINT "InventoryPhoto_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPhoto" ADD CONSTRAINT "InventoryPhoto_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "InventoryDefect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDefect" ADD CONSTRAINT "InventoryDefect_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDefect" ADD CONSTRAINT "InventoryDefect_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryInspection" ADD CONSTRAINT "InventoryInspection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryInspection" ADD CONSTRAINT "InventoryInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCheckout" ADD CONSTRAINT "InventoryCheckout_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCheckout" ADD CONSTRAINT "InventoryCheckout_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCheckoutLine" ADD CONSTRAINT "InventoryCheckoutLine_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "InventoryCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCheckoutLine" ADD CONSTRAINT "InventoryCheckoutLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStocktake" ADD CONSTRAINT "InventoryStocktake_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "InventoryArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStocktake" ADD CONSTRAINT "InventoryStocktake_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStocktakeScan" ADD CONSTRAINT "InventoryStocktakeScan_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "InventoryStocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStocktakeScan" ADD CONSTRAINT "InventoryStocktakeScan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStocktakeScan" ADD CONSTRAINT "InventoryStocktakeScan_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "InventoryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStocktakeScan" ADD CONSTRAINT "InventoryStocktakeScan_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStocktakeScan" ADD CONSTRAINT "InventoryStocktakeScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Standard-Bereiche
INSERT INTO "InventoryArea" ("id", "name", "prefix", "description", "sortOrder", "inspectionDefault", "updatedAt") VALUES
  ('inv_area_technik', 'Technik', 'T', 'Licht, Ton, Video, Strom und Kabel', 0, true, CURRENT_TIMESTAMP),
  ('inv_area_kostuem', 'Kostüm', 'K', 'Kostümfundus, Schuhe, Hüte, Accessoires', 1, false, CURRENT_TIMESTAMP),
  ('inv_area_requisite', 'Requisite', 'R', 'Requisiten und Dekoration', 2, false, CURRENT_TIMESTAMP),
  ('inv_area_buehnenbau', 'Bühnenbau', 'B', 'Podeste, Kulissen, Material', 3, false, CURRENT_TIMESTAMP),
  ('inv_area_werkzeug', 'Werkzeug', 'W', 'Werkzeug und Maschinen', 4, true, CURRENT_TIMESTAMP);

INSERT INTO "InventoryCategory" ("id", "areaId", "name", "sortOrder") VALUES
  ('inv_cat_t_licht', 'inv_area_technik', 'Licht', 0),
  ('inv_cat_t_ton', 'inv_area_technik', 'Ton', 1),
  ('inv_cat_t_video', 'inv_area_technik', 'Video', 2),
  ('inv_cat_t_strom', 'inv_area_technik', 'Strom', 3),
  ('inv_cat_t_kabel', 'inv_area_technik', 'Kabel', 4),
  ('inv_cat_t_netz', 'inv_area_technik', 'Netzwerk', 5),
  ('inv_cat_t_rigging', 'inv_area_technik', 'Rigging', 6),
  ('inv_cat_k_kostuem', 'inv_area_kostuem', 'Kostüm', 0),
  ('inv_cat_k_schuhe', 'inv_area_kostuem', 'Schuhe', 1),
  ('inv_cat_k_kopf', 'inv_area_kostuem', 'Hüte & Perücken', 2),
  ('inv_cat_k_acc', 'inv_area_kostuem', 'Accessoires', 3),
  ('inv_cat_r_req', 'inv_area_requisite', 'Requisite', 0),
  ('inv_cat_r_moebel', 'inv_area_requisite', 'Möbel', 1),
  ('inv_cat_r_deko', 'inv_area_requisite', 'Dekoration', 2),
  ('inv_cat_b_podest', 'inv_area_buehnenbau', 'Podeste', 0),
  ('inv_cat_b_kulisse', 'inv_area_buehnenbau', 'Kulissen', 1),
  ('inv_cat_b_material', 'inv_area_buehnenbau', 'Material', 2),
  ('inv_cat_w_hand', 'inv_area_werkzeug', 'Handwerkzeug', 0),
  ('inv_cat_w_elektro', 'inv_area_werkzeug', 'Elektrowerkzeug', 1);
