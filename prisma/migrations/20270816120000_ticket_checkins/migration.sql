-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('unused', 'checked_in', 'invalid');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "holderName" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'unused',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Ticket_code_key" UNIQUE ("code")
);

-- CreateTable
CREATE TABLE "TicketScanEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statusBefore" "TicketStatus" NOT NULL,
    "statusAfter" "TicketStatus" NOT NULL,
    "source" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "dedupeKey" TEXT,
    "serverSeq" INTEGER,
    "processedAt" TIMESTAMP(3),
    "provisional" BOOLEAN NOT NULL DEFAULT FALSE,
    "clientId" TEXT,
    "clientMutationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketScanEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TicketScanEvent_dedupeKey_key" UNIQUE ("dedupeKey")
);

-- CreateIndex
CREATE INDEX "Ticket_eventId_idx" ON "Ticket"("eventId");

-- CreateIndex
CREATE INDEX "TicketScanEvent_ticketId_occurredAt_idx" ON "TicketScanEvent"("ticketId", "occurredAt");

-- AddForeignKey
ALTER TABLE "TicketScanEvent"
  ADD CONSTRAINT "TicketScanEvent_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
