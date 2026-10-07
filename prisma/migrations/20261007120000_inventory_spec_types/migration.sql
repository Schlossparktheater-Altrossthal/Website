-- Lager – zusätzliche Merkmalstypen (docs/Plan/lager-merkmal-typen-plan.md):
-- Bereich von–bis, Bewertung, Farbe, Link, mehrzeiliger Text, Auswahl mit Freitext und
-- Datums-Zeitraum. Werte liegen weiterhin als JSON in `InventoryProduct.specs`.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryFieldType" ADD VALUE 'range';
ALTER TYPE "InventoryFieldType" ADD VALUE 'scale';
ALTER TYPE "InventoryFieldType" ADD VALUE 'color';
ALTER TYPE "InventoryFieldType" ADD VALUE 'url';
ALTER TYPE "InventoryFieldType" ADD VALUE 'note';
ALTER TYPE "InventoryFieldType" ADD VALUE 'combo';
ALTER TYPE "InventoryFieldType" ADD VALUE 'daterange';
