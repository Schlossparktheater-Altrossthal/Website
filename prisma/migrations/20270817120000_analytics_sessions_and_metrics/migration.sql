-- CreateTable
CREATE TABLE "public"."AnalyticsSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "membershipRole" TEXT,
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "pagePaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsPageView" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "path" TEXT NOT NULL,
    "scope" TEXT,
    "userAgent" TEXT,
    "deviceHint" TEXT,
    "lcpMs" DOUBLE PRECISION,
    "loadTimeMs" DOUBLE PRECISION,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyticsSessionId" TEXT,

    CONSTRAINT "AnalyticsPageView_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnalyticsPageView_sessionId_key" UNIQUE ("sessionId")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsDeviceSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "deviceHint" TEXT,
    "userAgent" TEXT,
    "platform" TEXT,
    "hardwareConcurrency" INTEGER,
    "deviceMemoryGb" DOUBLE PRECISION,
    "touchSupport" INTEGER,
    "reducedMotion" BOOLEAN,
    "prefersDarkMode" BOOLEAN,
    "colorScheme" TEXT,
    "connectionType" TEXT,
    "connectionEffectiveType" TEXT,
    "connectionRttMs" DOUBLE PRECISION,
    "connectionDownlinkMbps" DOUBLE PRECISION,
    "viewportWidth" INTEGER,
    "viewportHeight" INTEGER,
    "pixelRatio" DOUBLE PRECISION,
    "language" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsDeviceSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnalyticsDeviceSnapshot_sessionId_key" UNIQUE ("sessionId")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsTrafficAttribution" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "analyticsSessionId" TEXT,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "referrerDomain" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsTrafficAttribution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnalyticsTrafficAttribution_sessionId_key" UNIQUE ("sessionId")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsRealtimeEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsRealtimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_page_metrics" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "scope" TEXT,
    "avg_load" DOUBLE PRECISION NOT NULL,
    "lcp" DOUBLE PRECISION,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_page_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_device_metrics" (
    "id" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "avg_load" DOUBLE PRECISION NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_device_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_session_insights" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "avgSessionDurationSeconds" DOUBLE PRECISION NOT NULL,
    "pagesPerSession" DOUBLE PRECISION NOT NULL,
    "retentionRate" DOUBLE PRECISION NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_session_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_traffic_sources" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "avgSessionDurationSeconds" DOUBLE PRECISION NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL,
    "changePercent" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_traffic_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_realtime_summary" (
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "totalEvents" INTEGER NOT NULL,
    "eventCounts" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_realtime_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsSession_userId_idx" ON "public"."AnalyticsSession"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_lastSeenAt_idx" ON "public"."AnalyticsSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_path_idx" ON "public"."AnalyticsPageView"("path");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_scope_idx" ON "public"."AnalyticsPageView"("scope");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_deviceHint_idx" ON "public"."AnalyticsPageView"("deviceHint");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_createdAt_idx" ON "public"."AnalyticsPageView"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_analyticsSessionId_idx" ON "public"."AnalyticsPageView"("analyticsSessionId");

-- CreateIndex
CREATE INDEX "AnalyticsDeviceSnapshot_deviceHint_idx" ON "public"."AnalyticsDeviceSnapshot"("deviceHint");

-- CreateIndex
CREATE INDEX "AnalyticsDeviceSnapshot_createdAt_idx" ON "public"."AnalyticsDeviceSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_analyticsSessionId_idx" ON "public"."AnalyticsTrafficAttribution"("analyticsSessionId");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_path_idx" ON "public"."AnalyticsTrafficAttribution"("path");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_referrerDomain_idx" ON "public"."AnalyticsTrafficAttribution"("referrerDomain");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_utmSource_idx" ON "public"."AnalyticsTrafficAttribution"("utmSource");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_utmMedium_idx" ON "public"."AnalyticsTrafficAttribution"("utmMedium");

-- CreateIndex
CREATE INDEX "AnalyticsRealtimeEvent_occurredAt_idx" ON "public"."AnalyticsRealtimeEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsRealtimeEvent_eventType_occurredAt_idx" ON "public"."AnalyticsRealtimeEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_page_metrics_path_idx" ON "public"."analytics_page_metrics"("path");

-- CreateIndex
CREATE INDEX "analytics_page_metrics_scope_idx" ON "public"."analytics_page_metrics"("scope");

-- CreateIndex
CREATE INDEX "analytics_device_metrics_device_idx" ON "public"."analytics_device_metrics"("device");

-- CreateIndex
CREATE INDEX "analytics_session_insights_segment_idx" ON "public"."analytics_session_insights"("segment");

-- CreateIndex
CREATE INDEX "analytics_traffic_sources_channel_idx" ON "public"."analytics_traffic_sources"("channel");

-- CreateIndex
CREATE INDEX "analytics_realtime_summary_windowEnd_idx" ON "public"."analytics_realtime_summary"("windowEnd");

-- AddForeignKey
ALTER TABLE "public"."AnalyticsPageView" ADD CONSTRAINT "AnalyticsPageView_analyticsSessionId_fkey" FOREIGN KEY ("analyticsSessionId") REFERENCES "public"."AnalyticsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnalyticsTrafficAttribution" ADD CONSTRAINT "AnalyticsTrafficAttribution_analyticsSessionId_fkey" FOREIGN KEY ("analyticsSessionId") REFERENCES "public"."AnalyticsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
