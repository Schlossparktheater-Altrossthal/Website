import { NextResponse } from "next/server";

import { collectOnboardingAnalytics } from "@/lib/onboarding-analytics";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.ONBOARDING.ANALYTICS"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const data = await collectOnboardingAnalytics();
  const response = NextResponse.json({ analytics: data });
  if (data.offline) {
    response.headers.set("X-Analytics-Mode", "offline");
  }
  return response;
}
