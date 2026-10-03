-- Lager 2 (docs/Plan/lager-typen-projekte-plan.md): Artikeltypen, Kategorienbaum, Merkmale,
-- zufällige publicIds. Es gibt noch keine relevanten Lagerdaten – Bestand wird geleert,
-- Bereiche und Kategorien bleiben.
TRUNCATE TABLE "InventoryStocktakeScan", "InventoryStocktake", "InventoryCheckoutLine",
  "InventoryCheckout", "InventoryEvent", "InventoryInspection", "InventoryPhoto",
  "InventoryDefect", "InventoryStock", "InventoryAsset", "InventoryLocation";
UPDATE "InventoryArea" SET "nextNumber" = 1;

-- CreateEnum
CREATE TYPE "InventoryFieldType" AS ENUM ('text', 'number', 'select', 'boolean');

-- DropForeignKey
ALTER TABLE "InventoryAsset" DROP CONSTRAINT "InventoryAsset_categoryId_fkey";

-- DropIndex
DROP INDEX "InventoryCategory_areaId_name_key";

-- AlterTable
ALTER TABLE "InventoryAsset" DROP COLUMN "attributes",
DROP COLUMN "categoryId",
DROP COLUMN "description",
DROP COLUMN "inspectionIntervalMonths",
DROP COLUMN "inspectionRequired",
DROP COLUMN "manufacturer",
DROP COLUMN "minQuantity",
DROP COLUMN "model",
DROP COLUMN "name",
DROP COLUMN "publicNote",
DROP COLUMN "unit",
ADD COLUMN     "label" TEXT,
ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "InventoryCategory" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "InventoryLocation" ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "InventoryPhoto" ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "InventoryFieldDef" (
    "id" TEXT NOT NULL,
    "areaId" TEXT,
    "categoryId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "InventoryFieldType" NOT NULL DEFAULT 'text',
    "unit" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryProduct" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "categoryId" TEXT,
    "kind" "InventoryAssetKind" NOT NULL DEFAULT 'unique',
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "description" TEXT,
    "publicNote" TEXT,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "unit" TEXT,
    "minQuantity" INTEGER,
    "inspectionRequired" BOOLEAN NOT NULL DEFAULT false,
    "inspectionIntervalMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryFieldDef_areaId_key_key" ON "InventoryFieldDef"("areaId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryFieldDef_categoryId_key_key" ON "InventoryFieldDef"("categoryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_publicId_key" ON "InventoryProduct"("publicId");

-- CreateIndex
CREATE INDEX "InventoryProduct_areaId_idx" ON "InventoryProduct"("areaId");

-- CreateIndex
CREATE INDEX "InventoryProduct_categoryId_idx" ON "InventoryProduct"("categoryId");

-- CreateIndex
CREATE INDEX "InventoryProduct_name_idx" ON "InventoryProduct"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAsset_publicId_key" ON "InventoryAsset"("publicId");

-- CreateIndex
CREATE INDEX "InventoryAsset_productId_idx" ON "InventoryAsset"("productId");

-- CreateIndex
CREATE INDEX "InventoryCategory_parentId_idx" ON "InventoryCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_areaId_parentId_name_key" ON "InventoryCategory"("areaId", "parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_publicId_key" ON "InventoryLocation"("publicId");

-- CreateIndex
CREATE INDEX "InventoryPhoto_productId_idx" ON "InventoryPhoto"("productId");

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InventoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryFieldDef" ADD CONSTRAINT "InventoryFieldDef_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "InventoryArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryFieldDef" ADD CONSTRAINT "InventoryFieldDef_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "InventoryArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPhoto" ADD CONSTRAINT "InventoryPhoto_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Merkmale, die bisher fest im Code standen, als Bereichs-Merkmale.
INSERT INTO "InventoryFieldDef" ("id", "areaId", "key", "label", "type", "unit", "placeholder", "sortOrder")
SELECT v.id, v."areaId", v.key, v.label, v.type::"InventoryFieldType", v.unit, v.placeholder, v."sortOrder"
FROM (VALUES
  ('inv_f_k_size', 'inv_area_kostuem', 'size', 'Größe', 'text', NULL, 'z. B. 38 oder M', 0),
  ('inv_f_k_era', 'inv_area_kostuem', 'era', 'Epoche / Stil', 'text', NULL, 'z. B. 1920er', 1),
  ('inv_f_k_color', 'inv_area_kostuem', 'color', 'Farbe', 'text', NULL, NULL, 2),
  ('inv_f_k_material', 'inv_area_kostuem', 'material', 'Material', 'text', NULL, NULL, 3),
  ('inv_f_k_gender', 'inv_area_kostuem', 'gender', 'Schnitt', 'select', NULL, NULL, 4),
  ('inv_f_t_power', 'inv_area_technik', 'power', 'Leistung', 'number', 'W', NULL, 0),
  ('inv_f_t_connector', 'inv_area_technik', 'connector', 'Anschluss', 'text', NULL, 'z. B. Schuko, CEE 16 A', 1),
  ('inv_f_w_power', 'inv_area_werkzeug', 'power', 'Leistung', 'number', 'W', NULL, 0)
) AS v(id, "areaId", key, label, type, unit, placeholder, "sortOrder")
WHERE EXISTS (SELECT 1 FROM "InventoryArea" a WHERE a.id = v."areaId");

UPDATE "InventoryFieldDef" SET "options" = ARRAY['Damen', 'Herren', 'Unisex', 'Kinder']
WHERE id = 'inv_f_k_gender';

-- Unterkategorien für Ton und Licht als Startpunkt (pflegbar unter Einstellungen).
INSERT INTO "InventoryCategory" ("id", "areaId", "parentId", "name", "sortOrder")
SELECT v.id, 'inv_area_technik', v."parentId", v.name, v."sortOrder"
FROM (VALUES
  ('inv_cat_t_ton_mic', 'inv_cat_t_ton', 'Mikrofone', 0),
  ('inv_cat_t_ton_mic_dyn', 'inv_cat_t_ton_mic', 'Dynamisch', 0),
  ('inv_cat_t_ton_mic_kond', 'inv_cat_t_ton_mic', 'Kondensator', 1),
  ('inv_cat_t_ton_funk', 'inv_cat_t_ton', 'Funkstrecken', 1),
  ('inv_cat_t_ton_amp', 'inv_cat_t_ton', 'Endstufen', 2),
  ('inv_cat_t_ton_ls', 'inv_cat_t_ton', 'Lautsprecher', 3),
  ('inv_cat_t_ton_pult', 'inv_cat_t_ton', 'Mischpulte', 4),
  ('inv_cat_t_ton_di', 'inv_cat_t_ton', 'DI-Boxen', 5),
  ('inv_cat_t_licht_prof', 'inv_cat_t_licht', 'Profilscheinwerfer', 0),
  ('inv_cat_t_licht_fres', 'inv_cat_t_licht', 'Stufenlinsen / PC', 1),
  ('inv_cat_t_licht_par', 'inv_cat_t_licht', 'PAR / LED-PAR', 2),
  ('inv_cat_t_licht_mh', 'inv_cat_t_licht', 'Moving Heads', 3),
  ('inv_cat_t_licht_dim', 'inv_cat_t_licht', 'Dimmer', 4),
  ('inv_cat_t_licht_pult', 'inv_cat_t_licht', 'Lichtpulte', 5)
) AS v(id, "parentId", name, "sortOrder")
WHERE EXISTS (SELECT 1 FROM "InventoryCategory" c WHERE c.id = 'inv_cat_t_ton')
  AND EXISTS (SELECT 1 FROM "InventoryCategory" c WHERE c.id = 'inv_cat_t_licht')
ORDER BY v.id = 'inv_cat_t_ton_mic' DESC;

INSERT INTO "InventoryFieldDef" ("id", "categoryId", "key", "label", "type", "unit", "options", "sortOrder")
SELECT v.id, v."categoryId", v.key, v.label, v.type::"InventoryFieldType", v.unit, v.options, v."sortOrder"
FROM (VALUES
  ('inv_f_mic_pattern', 'inv_cat_t_ton_mic', 'pattern', 'Richtcharakteristik', 'select', NULL, ARRAY['Niere', 'Superniere', 'Hyperniere', 'Kugel', 'Acht'], 0),
  ('inv_f_mic_phantom', 'inv_cat_t_ton_mic', 'phantom', 'Phantomspeisung nötig', 'boolean', NULL, ARRAY[]::TEXT[], 1),
  ('inv_f_funk_band', 'inv_cat_t_ton_funk', 'band', 'Frequenzbereich', 'text', NULL, ARRAY[]::TEXT[], 0),
  ('inv_f_amp_channels', 'inv_cat_t_ton_amp', 'channels', 'Kanäle', 'number', NULL, ARRAY[]::TEXT[], 0),
  ('inv_f_amp_power4', 'inv_cat_t_ton_amp', 'power4ohm', 'Leistung an 4 Ω je Kanal', 'number', 'W', ARRAY[]::TEXT[], 1),
  ('inv_f_ls_type', 'inv_cat_t_ton_ls', 'speakerType', 'Bauart', 'select', NULL, ARRAY['Topteil', 'Subwoofer', 'Monitor', 'Fullrange'], 0),
  ('inv_f_ls_active', 'inv_cat_t_ton_ls', 'active', 'Aktiv', 'boolean', NULL, ARRAY[]::TEXT[], 1),
  ('inv_f_pult_channels', 'inv_cat_t_ton_pult', 'channels', 'Eingänge', 'number', NULL, ARRAY[]::TEXT[], 0),
  ('inv_f_licht_lamp', 'inv_cat_t_licht', 'lamp', 'Leuchtmittel', 'text', NULL, ARRAY[]::TEXT[], 0),
  ('inv_f_licht_dmx', 'inv_cat_t_licht', 'dmxChannels', 'DMX-Kanäle', 'number', NULL, ARRAY[]::TEXT[], 1),
  ('inv_f_prof_angle', 'inv_cat_t_licht_prof', 'beamAngle', 'Abstrahlwinkel', 'text', '°', ARRAY[]::TEXT[], 0)
) AS v(id, "categoryId", key, label, type, unit, options, "sortOrder")
WHERE EXISTS (SELECT 1 FROM "InventoryCategory" c WHERE c.id = v."categoryId");
