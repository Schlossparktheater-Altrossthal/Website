-- Lager-Projekte (docs/Plan/lager-typen-projekte-plan.md, Phase 6): Kunden, Phasen, Bedarf je Artikeltyp.
-- CreateEnum
CREATE TYPE "InventoryProjectStatus" AS ENUM ('request', 'confirmed', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "InventoryProjectPhaseKind" AS ENUM ('setup', 'event', 'teardown', 'other');

-- AlterTable
ALTER TABLE "InventoryCheckout" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "InventoryContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryProject" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InventoryProjectStatus" NOT NULL DEFAULT 'request',
    "contactId" TEXT,
    "venue" TEXT,
    "leadUserId" TEXT,
    "leadName" TEXT,
    "showId" TEXT,
    "note" TEXT,
    "startsOn" DATE,
    "endsOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "InventoryProjectPhaseKind" NOT NULL DEFAULT 'event',
    "label" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,

    CONSTRAINT "InventoryProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryProjectLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryProjectLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryContact_name_idx" ON "InventoryContact"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProject_publicId_key" ON "InventoryProject"("publicId");

-- CreateIndex
CREATE INDEX "InventoryProject_startsOn_endsOn_idx" ON "InventoryProject"("startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "InventoryProject_status_idx" ON "InventoryProject"("status");

-- CreateIndex
CREATE INDEX "InventoryProjectPhase_projectId_idx" ON "InventoryProjectPhase"("projectId");

-- CreateIndex
CREATE INDEX "InventoryProjectLine_productId_idx" ON "InventoryProjectLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProjectLine_projectId_productId_key" ON "InventoryProjectLine"("projectId", "productId");

-- CreateIndex
CREATE INDEX "InventoryCheckout_projectId_idx" ON "InventoryCheckout"("projectId");

-- AddForeignKey
ALTER TABLE "InventoryProject" ADD CONSTRAINT "InventoryProject_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "InventoryContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProject" ADD CONSTRAINT "InventoryProject_leadUserId_fkey" FOREIGN KEY ("leadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProject" ADD CONSTRAINT "InventoryProject_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProjectPhase" ADD CONSTRAINT "InventoryProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InventoryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProjectLine" ADD CONSTRAINT "InventoryProjectLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InventoryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProjectLine" ADD CONSTRAINT "InventoryProjectLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCheckout" ADD CONSTRAINT "InventoryCheckout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InventoryProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

