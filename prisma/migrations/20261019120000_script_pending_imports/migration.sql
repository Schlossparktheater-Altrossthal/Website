-- CreateTable
CREATE TABLE "ScriptPendingImport" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "versionDate" TIMESTAMP(3),
    "sourceBucket" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceSize" INTEGER NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastTriedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptPendingImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScriptPendingImport_showId_createdAt_idx" ON "ScriptPendingImport"("showId", "createdAt");

-- AddForeignKey
ALTER TABLE "ScriptPendingImport" ADD CONSTRAINT "ScriptPendingImport_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptPendingImport" ADD CONSTRAINT "ScriptPendingImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
