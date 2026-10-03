-- CreateTable
CREATE TABLE "analytics_performance_samples" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "route" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "feedbackMs" INTEGER,
    "ttfbMs" INTEGER,
    "fcpMs" INTEGER,
    "lcpMs" INTEGER,
    "inpMs" INTEGER,
    "cls" DOUBLE PRECISION,
    "deviceType" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "browserVersion" TEXT,
    "os" TEXT NOT NULL,
    "userAgent" TEXT,
    "effectiveType" TEXT,
    "standalone" BOOLEAN NOT NULL DEFAULT false,
    "analyticsSessionId" TEXT,

    CONSTRAINT "analytics_performance_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_performance_samples_createdAt_idx" ON "analytics_performance_samples"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_performance_samples_route_kind_idx" ON "analytics_performance_samples"("route", "kind");
