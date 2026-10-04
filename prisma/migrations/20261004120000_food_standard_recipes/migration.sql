-- Lebensmittel-Standard und Rezepte (docs/Plan/lebensmittel-standard-plan.md Phase 2,
-- docs/Plan/rezepte-plan.md Phase 1). Nur neue Tabellen und eine nullable Spalte.
-- CreateEnum
CREATE TYPE "FoodTaxonKind" AS ENUM ('INGREDIENT', 'ALLERGEN', 'SENSITIVITY');

-- CreateEnum
CREATE TYPE "FoodTaxonSource" AS ENUM ('OFF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FoodTaxonAliasSource" AS ENUM ('AUTO', 'CONFIRMED', 'MIGRATION');

-- CreateEnum
CREATE TYPE "FoodItemSource" AS ENUM ('BLS', 'OFF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FoodMatchStatus" AS ENUM ('MATCHED', 'PARTIAL', 'UNCLEAR', 'MANUAL');

-- AlterTable
ALTER TABLE "DietaryRestriction" ADD COLUMN     "taxonCode" TEXT;

-- CreateTable
CREATE TABLE "FoodTaxon" (
    "code" TEXT NOT NULL,
    "kind" "FoodTaxonKind" NOT NULL,
    "source" "FoodTaxonSource" NOT NULL,
    "nameDe" TEXT,
    "nameEn" TEXT,
    "synonymsDe" TEXT[],
    "synonymsEn" TEXT[],
    "parentCodes" TEXT[],
    "allergenCodes" TEXT[],
    "impliesCodes" TEXT[],
    "vegan" TEXT,
    "vegetarian" TEXT,
    "lmiv" BOOLEAN NOT NULL DEFAULT false,
    "sourceVersion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodTaxon_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "FoodTaxonAlias" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "taxonCode" TEXT NOT NULL,
    "source" "FoodTaxonAliasSource" NOT NULL DEFAULT 'CONFIRMED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodTaxonAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodItem" (
    "id" TEXT NOT NULL,
    "source" "FoodItemSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT,
    "groupCode" TEXT,
    "nutrients" JSONB NOT NULL,
    "taxonCodes" TEXT[],
    "tracesCodes" TEXT[],
    "matchStatus" "FoodMatchStatus" NOT NULL DEFAULT 'UNCLEAR',
    "pieceWeightG" DOUBLE PRECISION,
    "densityGPerMl" DOUBLE PRECISION,
    "sourceVersion" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodNutrient" (
    "code" TEXT NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "groupDe" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FoodNutrient_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "FoodDataImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "note" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodDataImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 4,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "tags" TEXT[],
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "prepMinutes" INTEGER,
    "cookMinutes" INTEGER,
    "computed" JSONB,
    "computedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "foodItemId" TEXT,
    "taxonCodes" TEXT[],
    "status" "FoodMatchStatus" NOT NULL DEFAULT 'UNCLEAR',

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeRating" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeComment" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodTaxon_kind_idx" ON "FoodTaxon"("kind");

-- CreateIndex
CREATE INDEX "FoodTaxon_nameDe_idx" ON "FoodTaxon"("nameDe");

-- CreateIndex
CREATE UNIQUE INDEX "FoodTaxonAlias_text_key" ON "FoodTaxonAlias"("text");

-- CreateIndex
CREATE INDEX "FoodTaxonAlias_taxonCode_idx" ON "FoodTaxonAlias"("taxonCode");

-- CreateIndex
CREATE INDEX "FoodItem_nameDe_idx" ON "FoodItem"("nameDe");

-- CreateIndex
CREATE UNIQUE INDEX "FoodItem_source_sourceId_key" ON "FoodItem"("source", "sourceId");

-- CreateIndex
CREATE INDEX "FoodDataImport_source_importedAt_idx" ON "FoodDataImport"("source", "importedAt");

-- CreateIndex
CREATE INDEX "Recipe_title_idx" ON "Recipe"("title");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_position_idx" ON "RecipeIngredient"("recipeId", "position");

-- CreateIndex
CREATE INDEX "RecipeIngredient_foodItemId_idx" ON "RecipeIngredient"("foodItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeRating_recipeId_userId_key" ON "RecipeRating"("recipeId", "userId");

-- CreateIndex
CREATE INDEX "RecipeComment_recipeId_createdAt_idx" ON "RecipeComment"("recipeId", "createdAt");

-- CreateIndex
CREATE INDEX "DietaryRestriction_taxonCode_idx" ON "DietaryRestriction"("taxonCode");

-- AddForeignKey
ALTER TABLE "DietaryRestriction" ADD CONSTRAINT "DietaryRestriction_taxonCode_fkey" FOREIGN KEY ("taxonCode") REFERENCES "FoodTaxon"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodTaxonAlias" ADD CONSTRAINT "FoodTaxonAlias_taxonCode_fkey" FOREIGN KEY ("taxonCode") REFERENCES "FoodTaxon"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodTaxonAlias" ADD CONSTRAINT "FoodTaxonAlias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComment" ADD CONSTRAINT "RecipeComment_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComment" ADD CONSTRAINT "RecipeComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

