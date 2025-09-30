import { prisma } from "@/lib/prisma";
import { runPageAnalyticsAggregation } from "@/lib/analytics/server-analytics-pipeline";

async function main() {
  const result = await runPageAnalyticsAggregation({ prisma });
  if (result.status === "skipped") {
    console.warn(
      `[analytics] Skipping page metrics aggregation (${result.reason ?? "unknown reason"}).`,
    );
  } else {
    console.info(
      `[analytics] Aggregated page metrics from ${result.data.pageViewCount} page view samples.`,
    );
  }
}

void main()
  .catch((error) => {
    console.error("[analytics] Failed to aggregate page metrics", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.error("[analytics] Failed to disconnect Prisma after page aggregation", error);
      }
    }
  });
