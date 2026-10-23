-- Finanzen Phase 2: Belege als Bytes in der DB (wie Ausstattungsfotos), Erstattung auch per PayPal
-- (Zahlungsdaten aus dem Profil). FinanceReceipt ist noch leer.
ALTER TABLE "FinanceReceipt" DROP COLUMN "storageKey",
ADD COLUMN     "data" BYTEA NOT NULL;

ALTER TYPE "ExpenseClaimPayout" ADD VALUE 'paypal' BEFORE 'donated';
