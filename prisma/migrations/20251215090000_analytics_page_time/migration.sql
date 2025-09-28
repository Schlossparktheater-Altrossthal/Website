ALTER TABLE "public"."AnalyticsPageView"
  ADD COLUMN "timeOnPageMs" INTEGER;

ALTER TABLE "public"."analytics_page_metrics"
  ADD COLUMN "avg_time_on_page" DOUBLE PRECISION;
