import { prisma } from "@/lib/prisma";
import { aggregatePageMetrics } from "@/lib/analytics/aggregate-page-metrics";

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_RETENTION_DAYS = 60;

function resolvePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[analytics] DATABASE_URL is not set. Skipping page metrics aggregation.");
    return;
  }

  const now = new Date();
  const windowDays = resolvePositiveInteger(process.env.ANALYTICS_PAGE_WINDOW_DAYS, DEFAULT_WINDOW_DAYS);
  const retentionDays = resolvePositiveInteger(
    process.env.ANALYTICS_PAGE_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
  );
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const pageViews = await prisma.analyticsPageView.findMany({
    where: {
      createdAt: {
        gte: windowStart,
        lte: now,
      },
    },
    select: {
      path: true,
      scope: true,
      deviceHint: true,
      loadTimeMs: true,
      lcpMs: true,
      weight: true,
    },
  });

  const { pages, devices } = aggregatePageMetrics(pageViews);

  await prisma.$transaction(async (tx) => {
    await tx.analyticsPageMetric.deleteMany({});
    await tx.analyticsDeviceMetric.deleteMany({});

    if (pages.length > 0) {
      await tx.analyticsPageMetric.createMany({
        data: pages.map((page) => ({
          path: page.path,
          scope: page.scope,
          avgLoadMs: page.avgLoadMs,
          lcpMs: page.lcpMs,
          weight: page.weight,
        })),
      });
    }

    if (devices.length > 0) {
      await tx.analyticsDeviceMetric.createMany({
        data: devices.map((device) => ({
          device: device.device,
          sessions: device.sessions,
          avgLoadMs: device.avgLoadMs,
          share: device.share,
        })),
      });
    }

    if (retentionDays > 0) {
      const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
      await tx.analyticsPageView.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });
      await tx.analyticsDeviceSnapshot.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });
    }
  });
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
