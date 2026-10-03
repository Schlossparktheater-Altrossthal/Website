-- AlterTable
ALTER TABLE "analytics_performance_samples" ADD COLUMN "serverMs" INTEGER,
ADD COLUMN "requestCount" INTEGER;

-- CreateTable
CREATE TABLE "analytics_error_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "userId" TEXT,

    CONSTRAINT "analytics_error_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_error_events_createdAt_idx" ON "analytics_error_events"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_error_events_route_idx" ON "analytics_error_events"("route");
