-- Finanzen neu (docs/Plan/finanzen-plan.md, Phase 1). Die alte Finanzverwaltung ist seit 2026-05
-- ohne Oberfläche; in Prod lag nur eine Testbuchung. Alte Daten werden verworfen.
TRUNCATE TABLE "FinanceLog", "FinanceAttachment", "FinanceEntry", "FinanceBudget";

-- CreateEnum
CREATE TYPE "FinanceEntryType" AS ENUM ('income', 'expense', 'transfer');

-- CreateEnum
CREATE TYPE "FinanceEntrySource" AS ENUM ('manual', 'expense_claim', 'box_office', 'tickets', 'donation');

-- CreateEnum
CREATE TYPE "FinanceFundKind" AS ENUM ('bank', 'cash', 'other');

-- CreateEnum
CREATE TYPE "FinanceCategoryType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "FinancePeriodKind" AS ENUM ('production', 'general');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('submitted', 'approved', 'rejected', 'paid');

-- CreateEnum
CREATE TYPE "ExpenseClaimPayout" AS ENUM ('cash', 'bank', 'donated');

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_showId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_memberPaidById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAttachment" DROP CONSTRAINT "FinanceAttachment_entryId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceBudget" DROP CONSTRAINT "FinanceBudget_showId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceLog" DROP CONSTRAINT "FinanceLog_changedById_fkey";

-- DropIndex
DROP INDEX "FinanceEntry_showId_status_idx";

-- DropIndex
DROP INDEX "FinanceEntry_budgetId_idx";

-- DropIndex
DROP INDEX "FinanceEntry_memberPaidById_bookingDate_idx";

-- DropIndex
DROP INDEX "FinanceBudget_showId_category_idx";

-- DropIndex
DROP INDEX "FinanceLog_changedById_idx";

-- AlterTable
ALTER TABLE "FinanceEntry" DROP COLUMN "amount",
DROP COLUMN "approvedAt",
DROP COLUMN "approvedById",
DROP COLUMN "budgetId",
DROP COLUMN "category",
DROP COLUMN "currency",
DROP COLUMN "donationSource",
DROP COLUMN "donorContact",
DROP COLUMN "dueDate",
DROP COLUMN "invoiceNumber",
DROP COLUMN "kind",
DROP COLUMN "memberPaidById",
DROP COLUMN "paidAt",
DROP COLUMN "showId",
DROP COLUMN "status",
DROP COLUMN "tags",
DROP COLUMN "title",
DROP COLUMN "vendor",
DROP COLUMN "visibilityScope",
ADD COLUMN     "amountCents" INTEGER NOT NULL,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "counterparty" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "donorAddress" TEXT,
ADD COLUMN     "donorName" TEXT,
ADD COLUMN     "fundId" TEXT NOT NULL,
ADD COLUMN     "number" INTEGER NOT NULL,
ADD COLUMN     "performanceEventId" TEXT,
ADD COLUMN     "periodId" TEXT NOT NULL,
ADD COLUMN     "reversalOfId" TEXT,
ADD COLUMN     "source" "FinanceEntrySource" NOT NULL DEFAULT 'manual',
ADD COLUMN     "transferFundId" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "FinanceEntryType" NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "bookingDate" DROP DEFAULT,
ALTER COLUMN "bookingDate" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "FinanceBudget" DROP COLUMN "category",
DROP COLUMN "currency",
DROP COLUMN "plannedAmount",
DROP COLUMN "showId",
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "fundId" TEXT,
ADD COLUMN     "periodId" TEXT NOT NULL,
ADD COLUMN     "plannedCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FinanceLog" DROP COLUMN "changedById",
DROP COLUMN "fromStatus",
DROP COLUMN "note",
DROP COLUMN "toStatus",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "claimId" TEXT,
ADD COLUMN     "data" JSONB,
ALTER COLUMN "entryId" DROP NOT NULL;

-- DropTable
DROP TABLE "FinanceAttachment";

-- DropEnum
DROP TYPE "FinanceType";

-- DropEnum
DROP TYPE "FinanceEntryKind";

-- DropEnum
DROP TYPE "FinanceEntryStatus";

-- DropEnum
DROP TYPE "VisibilityScope";

-- CreateTable
CREATE TABLE "FinanceFund" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "FinanceFundKind" NOT NULL DEFAULT 'bank',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePeriod" (
    "id" TEXT NOT NULL,
    "kind" "FinancePeriodKind" NOT NULL,
    "showId" TEXT,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "lockedThrough" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceCategoryType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "spentOn" DATE NOT NULL,
    "purpose" TEXT NOT NULL,
    "vendor" TEXT,
    "departmentId" TEXT,
    "categoryId" TEXT,
    "payout" "ExpenseClaimPayout" NOT NULL DEFAULT 'cash',
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'submitted',
    "departmentCheckedById" TEXT,
    "departmentCheckedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "fundId" TEXT,
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReceipt" (
    "id" TEXT NOT NULL,
    "entryId" TEXT,
    "claimId" TEXT,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "ocr" JSONB,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFund_name_key" ON "FinanceFund"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePeriod_showId_key" ON "FinancePeriod"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePeriod_code_key" ON "FinancePeriod"("code");

-- CreateIndex
CREATE INDEX "FinancePeriod_kind_year_idx" ON "FinancePeriod"("kind", "year");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_type_name_key" ON "FinanceCategory"("type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_entryId_key" ON "ExpenseClaim"("entryId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_periodId_status_idx" ON "ExpenseClaim"("periodId", "status");

-- CreateIndex
CREATE INDEX "ExpenseClaim_submittedById_idx" ON "ExpenseClaim"("submittedById");

-- CreateIndex
CREATE INDEX "ExpenseClaim_departmentId_status_idx" ON "ExpenseClaim"("departmentId", "status");

-- CreateIndex
CREATE INDEX "FinanceReceipt_entryId_idx" ON "FinanceReceipt"("entryId");

-- CreateIndex
CREATE INDEX "FinanceReceipt_claimId_idx" ON "FinanceReceipt"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_reversalOfId_key" ON "FinanceEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "FinanceEntry_fundId_bookingDate_idx" ON "FinanceEntry"("fundId", "bookingDate");

-- CreateIndex
CREATE INDEX "FinanceEntry_departmentId_idx" ON "FinanceEntry"("departmentId");

-- CreateIndex
CREATE INDEX "FinanceEntry_objectId_idx" ON "FinanceEntry"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_periodId_number_key" ON "FinanceEntry"("periodId", "number");

-- CreateIndex
CREATE INDEX "FinanceBudget_periodId_idx" ON "FinanceBudget"("periodId");

-- CreateIndex
CREATE INDEX "FinanceBudget_departmentId_idx" ON "FinanceBudget"("departmentId");

-- CreateIndex
CREATE INDEX "FinanceLog_claimId_idx" ON "FinanceLog"("claimId");

-- AddForeignKey
ALTER TABLE "FinancePeriod" ADD CONSTRAINT "FinancePeriod_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "FinanceFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "FinanceFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_transferFundId_fkey" FOREIGN KEY ("transferFundId") REFERENCES "FinanceFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_performanceEventId_fkey" FOREIGN KEY ("performanceEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_departmentCheckedById_fkey" FOREIGN KEY ("departmentCheckedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "FinanceFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT "FinanceReceipt_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT "FinanceReceipt_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT "FinanceReceipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLog" ADD CONSTRAINT "FinanceLog_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLog" ADD CONSTRAINT "FinanceLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Beträge sind immer positiv, die Richtung steckt im Typ.
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_amountCents_positive" CHECK ("amountCents" > 0);
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_amountCents_positive" CHECK ("amountCents" > 0);
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_plannedCents_nonneg" CHECK ("plannedCents" >= 0);
-- Umbuchung braucht Ziel-Topf, alle anderen Buchungen keinen.
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_transfer_fund" CHECK (("type" = 'transfer') = ("transferFundId" IS NOT NULL));
-- Höchstens ein Zeitraum „Allgemein“ je Jahr.
CREATE UNIQUE INDEX "FinancePeriod_general_year_key" ON "FinancePeriod"("year") WHERE "kind" = 'general';

-- Startkategorien (in der Oberfläche änder- und archivierbar).
INSERT INTO "FinanceCategory" ("id", "name", "type", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Kartenverkauf', 'income', 10, now()),
  (gen_random_uuid()::text, 'Abendkasse', 'income', 20, now()),
  (gen_random_uuid()::text, 'Spenden', 'income', 30, now()),
  (gen_random_uuid()::text, 'Förderung', 'income', 40, now()),
  (gen_random_uuid()::text, 'Sonstige Einnahmen', 'income', 90, now()),
  (gen_random_uuid()::text, 'Material', 'expense', 10, now()),
  (gen_random_uuid()::text, 'Verpflegung', 'expense', 20, now()),
  (gen_random_uuid()::text, 'Technik & Verleih', 'expense', 30, now()),
  (gen_random_uuid()::text, 'Druck & Werbung', 'expense', 40, now()),
  (gen_random_uuid()::text, 'Rechte & Gebühren', 'expense', 50, now()),
  (gen_random_uuid()::text, 'Fahrtkosten', 'expense', 60, now()),
  (gen_random_uuid()::text, 'Sonstige Ausgaben', 'expense', 90, now());
