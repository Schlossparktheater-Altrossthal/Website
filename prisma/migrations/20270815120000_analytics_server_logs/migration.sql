-- CreateEnum
CREATE TYPE "AnalyticsServerLogSeverity" AS ENUM ('info', 'warning', 'error');

-- CreateEnum
CREATE TYPE "AnalyticsServerLogStatus" AS ENUM ('open', 'monitoring', 'resolved');

-- CreateTable
CREATE TABLE "analytics_server_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "severity" "AnalyticsServerLogSeverity" NOT NULL,
    "service" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "AnalyticsServerLogStatus" NOT NULL DEFAULT 'open',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "affectedUsers" INTEGER,
    "recommendedAction" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "analytics_server_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "analytics_server_logs_fingerprint_key" UNIQUE ("fingerprint")
);

-- CreateIndex
CREATE INDEX "analytics_server_logs_severity_lastSeenAt_idx" ON "analytics_server_logs"("severity", "lastSeenAt");

-- CreateIndex
CREATE INDEX "analytics_server_logs_status_lastSeenAt_idx" ON "analytics_server_logs"("status", "lastSeenAt");
