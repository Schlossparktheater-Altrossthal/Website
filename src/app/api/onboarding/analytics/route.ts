import { NextResponse } from "next/server";

import { collectOnboardingAnalytics } from "@/lib/onboarding-analytics";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.onboarding.analytics"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await collectOnboardingAnalytics();
  return NextResponse.json({ analytics: data });
}
