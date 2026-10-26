-- CreateTable
CREATE TABLE "CashCount" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "countedCents" INTEGER NOT NULL,
    "expectedCents" INTEGER NOT NULL,
    "notes" TEXT,
    "entryId" TEXT,
    "countedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashCount_entryId_key" ON "CashCount"("entryId");

-- CreateIndex
CREATE INDEX "CashCount_eventId_idx" ON "CashCount"("eventId");

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "FinanceFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

