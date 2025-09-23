import { NextResponse } from "next/server";

import { getDashboardOverview, DashboardOverviewAccessError } from "@/lib/dashboard-overview";
import { requireAuth } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    const overview = await getDashboardOverview(session);
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof DashboardOverviewAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("[Dashboard API] Error loading overview:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
