import { prisma } from "@/lib/prisma";
import { runHttpAnalyticsAggregation } from "@/lib/analytics/server-analytics-pipeline";

async function main() {
  const result = await runHttpAnalyticsAggregation({ prisma });
  if (result.status === "skipped") {
    console.warn(
      `[analytics] Skipping HTTP aggregation batch (${result.reason ?? "unknown reason"}).`,
    );
  } else {
    console.info(
      `[analytics] Aggregated HTTP metrics for ${result.data.requestCount} requests between ${result.data.windowStart.toISOString()} and ${result.data.windowEnd.toISOString()}.`,
    );
  }
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
