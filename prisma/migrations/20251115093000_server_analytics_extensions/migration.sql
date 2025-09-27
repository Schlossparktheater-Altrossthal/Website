-- Add cache metrics and background job counters to HTTP summary
ALTER TABLE "public"."analytics_http_summary"
  ADD COLUMN IF NOT EXISTS "cacheHitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "frontendCacheHitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "apiBackgroundJobs" INTEGER NOT NULL DEFAULT 0;

-- Create session summary table for peak concurrency and realtime usage
CREATE TABLE IF NOT EXISTS "public"."analytics_session_summary" (
  "id" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "peakConcurrentUsers" INTEGER NOT NULL DEFAULT 0,
  "membersRealtimeEvents" INTEGER NOT NULL DEFAULT 0,
  "membersAvgSessionDurationSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_session_summary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_session_summary_windowEnd_idx"
  ON "public"."analytics_session_summary"("windowEnd");
