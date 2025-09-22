-- CreateEnum
CREATE TYPE "GalleryMediaType" AS ENUM ('image', 'video');

-- CreateTable
CREATE TABLE "public"."GalleryItem" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mediaType" "GalleryMediaType" NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."GalleryItem"
  ADD CONSTRAINT "GalleryItem_uploadedById_fkey"
  FOREIGN KEY ("uploadedById")
  REFERENCES "public"."User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "GalleryItem_year_createdAt_idx"
  ON "public"."GalleryItem"("year", "createdAt");
