-- Create new enums for finance entries
CREATE TYPE "public"."FinanceEntryKind" AS ENUM ('general', 'invoice', 'donation');
CREATE TYPE "public"."FinanceEntryStatus" AS ENUM ('draft', 'pending', 'approved', 'paid', 'cancelled');

-- Extend FinanceEntry with richer bookkeeping fields
ALTER TABLE "public"."FinanceEntry"
  ADD COLUMN "kind" "public"."FinanceEntryKind" NOT NULL DEFAULT 'general',
  ADD COLUMN "status" "public"."FinanceEntryStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "title" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "vendor" TEXT,
  ADD COLUMN "memberPaidById" TEXT,
  ADD COLUMN "donationSource" TEXT,
  ADD COLUMN "donorContact" TEXT,
  ADD COLUMN "tags" JSONB,
  ADD COLUMN "budgetId" TEXT,
  ADD COLUMN "createdById" TEXT NOT NULL,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "public"."FinanceEntry" SET "title" = COALESCE("title", 'Finanzbuchung');
ALTER TABLE "public"."FinanceEntry" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "public"."FinanceEntry" ALTER COLUMN "visibilityScope" SET DEFAULT 'finance';

-- Create finance budgets table
CREATE TABLE "public"."FinanceBudget" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "category" TEXT NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceBudget_pkey" PRIMARY KEY ("id")
);

-- Create attachments table for finance entries
CREATE TABLE "public"."FinanceAttachment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceAttachment_pkey" PRIMARY KEY ("id")
);

-- Create status log table for finance entries
CREATE TABLE "public"."FinanceLog" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "changedById" TEXT,
    "fromStatus" "public"."FinanceEntryStatus",
    "toStatus" "public"."FinanceEntryStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceLog_pkey" PRIMARY KEY ("id")
);

-- Create supporting indexes
CREATE INDEX "FinanceEntry_showId_status_idx" ON "public"."FinanceEntry"("showId", "status");
CREATE INDEX "FinanceEntry_budgetId_idx" ON "public"."FinanceEntry"("budgetId");
CREATE INDEX "FinanceEntry_memberPaidById_bookingDate_idx" ON "public"."FinanceEntry"("memberPaidById", "bookingDate");
CREATE INDEX "FinanceAttachment_entryId_idx" ON "public"."FinanceAttachment"("entryId");
CREATE INDEX "FinanceBudget_showId_category_idx" ON "public"."FinanceBudget"("showId", "category");
CREATE INDEX "FinanceLog_entryId_idx" ON "public"."FinanceLog"("entryId");
CREATE INDEX "FinanceLog_changedById_idx" ON "public"."FinanceLog"("changedById");

-- Wire up foreign keys
ALTER TABLE "public"."FinanceBudget"
  ADD CONSTRAINT "FinanceBudget_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinanceEntry"
  ADD CONSTRAINT "FinanceEntry_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "public"."FinanceBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceEntry_memberPaidById_fkey" FOREIGN KEY ("memberPaidById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinanceAttachment"
  ADD CONSTRAINT "FinanceAttachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FinanceLog"
  ADD CONSTRAINT "FinanceLog_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
