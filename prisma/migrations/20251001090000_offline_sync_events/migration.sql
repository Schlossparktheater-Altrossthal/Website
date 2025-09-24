-- CreateEnum
CREATE TYPE "SyncScope" AS ENUM ('inventory', 'tickets');

-- CreateTable
CREATE TABLE "SyncMutation" (
  "clientMutationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "scope" "SyncScope" NOT NULL,
  "eventCount" INTEGER NOT NULL,
  "firstServerSeq" INTEGER,
  "lastServerSeq" INTEGER,
  "acknowledgedSeq" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncMutation_pkey" PRIMARY KEY ("clientMutationId")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
  "id" TEXT NOT NULL,
  "scope" "SyncScope" NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientMutationId" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "serverSeq" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SyncEvent_serverSeq_key" UNIQUE ("serverSeq")
);

-- CreateIndex
CREATE INDEX "SyncEvent_scope_serverSeq_idx" ON "SyncEvent"("scope", "serverSeq");

-- CreateIndex
CREATE INDEX "SyncEvent_scope_dedupeKey_idx" ON "SyncEvent"("scope", "dedupeKey");

-- CreateIndex
CREATE INDEX "SyncEvent_scope_occurredAt_idx" ON "SyncEvent"("scope", "occurredAt");

-- CreateIndex
CREATE INDEX "SyncMutation_scope_clientId_idx" ON "SyncMutation"("scope", "clientId");

-- AddForeignKey
ALTER TABLE "SyncEvent"
  ADD CONSTRAINT "SyncEvent_clientMutationId_fkey"
  FOREIGN KEY ("clientMutationId") REFERENCES "SyncMutation"("clientMutationId")
  ON DELETE CASCADE ON UPDATE CASCADE;
