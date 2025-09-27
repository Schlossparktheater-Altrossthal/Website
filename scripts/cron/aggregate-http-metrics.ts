import { prisma } from "@/lib/prisma";
import { aggregateHttpMetrics } from "@/lib/analytics/aggregate-http";

const DEFAULT_WINDOW_MINUTES = 24 * 60;
const DEFAULT_BUCKET_MINUTES = 60;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[analytics] DATABASE_URL is not set. Skipping HTTP aggregation batch.");
    return;
  }

  const now = new Date();
  const windowMinutes = Number(process.env.ANALYTICS_HTTP_WINDOW_MINUTES ?? DEFAULT_WINDOW_MINUTES);
  const bucketMinutes = Number(process.env.ANALYTICS_HTTP_BUCKET_MINUTES ?? DEFAULT_BUCKET_MINUTES);
  const windowStart = new Date(now.getTime() - Math.max(windowMinutes, 5) * 60_000);

  const [requests, heartbeats] = await Promise.all([
    prisma.analyticsHttpRequest.findMany({
      where: {
        timestamp: {
          gte: windowStart,
          lte: now,
        },
      },
      orderBy: { timestamp: "asc" },
    }),
    prisma.analyticsUptimeHeartbeat.findMany({
      where: {
        observedAt: {
          gte: windowStart,
          lte: now,
        },
      },
    }),
  ]);

  const { summary, peakHours } = aggregateHttpMetrics({
    requests,
    heartbeats,
    windowStart,
    windowEnd: now,
    bucketMinutes,
  });

  await prisma.$transaction(async (tx) => {
    await tx.analyticsHttpSummary.deleteMany({});
    await tx.analyticsHttpPeakHour.deleteMany({});

    await tx.analyticsHttpSummary.create({
      data: {
        windowStart: summary.windowStart,
        windowEnd: summary.windowEnd,
        totalRequests: summary.totalRequests,
        successfulRequests: summary.successfulRequests,
        clientErrorRequests: summary.clientErrorRequests,
        serverErrorRequests: summary.serverErrorRequests,
        averageDurationMs: summary.averageDurationMs,
        p95DurationMs: summary.p95DurationMs,
        averagePayloadBytes: summary.averagePayloadBytes,
        uptimePercentage: summary.uptimePercentage,
        frontendRequests: summary.frontendRequests,
        frontendAvgResponseMs: summary.frontendAvgResponseMs,
        frontendAvgPayloadBytes: summary.frontendAvgPayloadBytes,
        cacheHitRate: summary.cacheHitRate,
        frontendCacheHitRate: summary.frontendCacheHitRate,
        membersRequests: summary.membersRequests,
        membersAvgResponseMs: summary.membersAvgResponseMs,
        apiRequests: summary.apiRequests,
        apiAvgResponseMs: summary.apiAvgResponseMs,
        apiErrorRate: summary.apiErrorRate,
        apiBackgroundJobs: summary.apiBackgroundJobs,
      },
    });

    if (peakHours.length > 0) {
      await tx.analyticsHttpPeakHour.createMany({
        data: peakHours.map((entry) => ({
          bucketStart: entry.bucketStart,
          bucketEnd: entry.bucketEnd,
          requests: entry.requests,
          share: entry.share,
        })),
      });
    }
  });
}

void main()
  .catch((error) => {
    console.error("[analytics] Failed to aggregate HTTP metrics", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.error("[analytics] Failed to disconnect Prisma after aggregation", error);
      }
    }
  });
