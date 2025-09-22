-- CreateTable
CREATE TABLE "public"."WebsiteTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tokens" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteSettings" (
    "id" TEXT NOT NULL,
    "siteTitle" TEXT NOT NULL DEFAULT 'Sommertheater im Schlosspark',
    "colorMode" TEXT NOT NULL DEFAULT 'dark',
    "themeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteSettings_themeId_idx"
  ON "public"."WebsiteSettings"("themeId");

-- AddForeignKey
ALTER TABLE "public"."WebsiteSettings"
  ADD CONSTRAINT "WebsiteSettings_themeId_fkey"
  FOREIGN KEY ("themeId")
  REFERENCES "public"."WebsiteTheme"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
