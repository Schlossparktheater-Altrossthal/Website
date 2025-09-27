-- CreateEnum
CREATE TYPE "public"."PayoutMethod" AS ENUM ('BANK_TRANSFER', 'PAYPAL', 'OTHER');

-- AlterTable
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "payoutMethod" "public"."PayoutMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  ADD COLUMN IF NOT EXISTS "payoutAccountHolder" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutIban" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutBankName" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutPaypalHandle" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutNote" TEXT;
