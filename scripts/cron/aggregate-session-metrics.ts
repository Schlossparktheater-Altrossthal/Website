import { prisma } from "@/lib/prisma";
import { runSessionAnalyticsAggregation } from "@/lib/analytics/server-analytics-pipeline";

async function main() {
  const result = await runSessionAnalyticsAggregation({ prisma });
  if (result.status === "skipped") {
    console.warn(
      `[analytics] Skipping session metrics aggregation (${result.reason ?? "unknown reason"}).`,
    );
  } else {
    console.info(
      `[analytics] Aggregated ${result.data.sessionCount} sessions, ${result.data.trafficAttributionCount} traffic entries and ${result.data.realtimeEventCount} realtime events.`,
    );
  }
}

void main()
  .catch((error) => {
    console.error("[analytics] Failed to aggregate session metrics", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.error("[analytics] Failed to disconnect Prisma after session aggregation", error);
      }
    }
  });
