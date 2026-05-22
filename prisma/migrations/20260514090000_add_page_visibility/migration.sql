ALTER TABLE "WebsiteSettings"
  ADD COLUMN IF NOT EXISTS "pageVisibility" JSONB;
