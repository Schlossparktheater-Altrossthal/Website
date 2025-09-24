-- CreateEnum
CREATE TYPE "public"."AnalyticsRequestArea" AS ENUM ('public', 'members', 'api', 'unknown');

-- CreateTable
CREATE TABLE "public"."AnalyticsHttpRequest" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "route" TEXT NOT NULL,
    "area" "public"."AnalyticsRequestArea" NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "payloadBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsHttpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsUptimeHeartbeat" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'app-server',
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "latencyMs" INTEGER,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsUptimeHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_http_summary" (
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successfulRequests" INTEGER NOT NULL DEFAULT 0,
    "clientErrorRequests" INTEGER NOT NULL DEFAULT 0,
    "serverErrorRequests" INTEGER NOT NULL DEFAULT 0,
    "averageDurationMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p95DurationMs" INTEGER,
    "averagePayloadBytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uptimePercentage" DOUBLE PRECISION,
    "frontendRequests" INTEGER NOT NULL DEFAULT 0,
    "frontendAvgResponseMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frontendAvgPayloadBytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "membersRequests" INTEGER NOT NULL DEFAULT 0,
    "membersAvgResponseMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apiRequests" INTEGER NOT NULL DEFAULT 0,
    "apiAvgResponseMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apiErrorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_http_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_http_peak_hours" (
    "id" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "bucketEnd" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "share" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_http_peak_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsHttpRequest_timestamp_idx" ON "public"."AnalyticsHttpRequest"("timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsHttpRequest_area_timestamp_idx" ON "public"."AnalyticsHttpRequest"("area", "timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsHttpRequest_route_idx" ON "public"."AnalyticsHttpRequest"("route");

-- CreateIndex
CREATE INDEX "AnalyticsUptimeHeartbeat_service_observedAt_idx" ON "public"."AnalyticsUptimeHeartbeat"("service", "observedAt");

-- CreateIndex
CREATE INDEX "AnalyticsUptimeHeartbeat_observedAt_idx" ON "public"."AnalyticsUptimeHeartbeat"("observedAt");

-- CreateIndex
CREATE INDEX "analytics_http_summary_windowEnd_idx" ON "public"."analytics_http_summary"("windowEnd");

-- CreateIndex
CREATE INDEX "analytics_http_peak_hours_bucketStart_idx" ON "public"."analytics_http_peak_hours"("bucketStart");
