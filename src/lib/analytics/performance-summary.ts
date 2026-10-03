import { prisma } from "@/lib/prisma";

import { summarizePerformanceSamples, type PerformanceSummary } from "./performance-samples";

const MAX_ROWS = 50_000;

export async function loadPerformanceSummary(days = 14): Promise<PerformanceSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.analyticsPerformanceSample.findMany({
    where: { createdAt: { gte: since } },
    select: {
      route: true,
      kind: true,
      durationMs: true,
      feedbackMs: true,
      ttfbMs: true,
      lcpMs: true,
      inpMs: true,
      deviceType: true,
      browser: true,
      os: true,
      standalone: true,
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });
  return summarizePerformanceSamples(rows, days);
}
