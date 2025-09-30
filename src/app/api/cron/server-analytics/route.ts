import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runServerAnalyticsAggregation } from "@/lib/analytics/server-analytics-pipeline";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = request.headers.get("x-cron-secret");
  if (!cronSecret) {
    return false;
  }
  if (!process.env.CRON_SECRET) {
    console.warn("[analytics] CRON_SECRET is not configured – rejecting request");
    return false;
  }
  return cronSecret === process.env.CRON_SECRET;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runServerAnalyticsAggregation();
    return NextResponse.json({ status: "ok", result });
  } catch (error) {
    console.error("[analytics] Failed to execute server analytics aggregation", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
