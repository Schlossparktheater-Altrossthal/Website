-- CreateTable
CREATE TABLE "DataPortalAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showId" TEXT,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataPortalAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataPortalAuditLog_createdAt_idx" ON "DataPortalAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DataPortalAuditLog_userId_createdAt_idx" ON "DataPortalAuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DataPortalAuditLog" ADD CONSTRAINT "DataPortalAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
