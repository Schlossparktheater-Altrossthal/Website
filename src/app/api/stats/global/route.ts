import { NextResponse } from "next/server";

import { loadOnboardingGlobalStats } from "@/lib/onboarding-dashboard";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    const user = session.user;
    if (!user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const allowed = await hasPermission(user, "mitglieder.dashboard");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await loadOnboardingGlobalStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[onboarding-dashboard.global]", error);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
