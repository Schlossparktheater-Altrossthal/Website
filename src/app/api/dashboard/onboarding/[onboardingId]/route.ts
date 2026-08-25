import { NextResponse } from "next/server";

import { getOnboardingDashboardData } from "@/lib/onboarding/dashboard-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ onboardingId: string }> },
) {
  const params = await context.params;
  const onboardingId = params?.onboardingId;

  if (!onboardingId || typeof onboardingId !== "string") {
    return NextResponse.json({ error: "Onboarding-ID fehlt" }, { status: 400 });
  }

  try {
    const data = await getOnboardingDashboardData(onboardingId);
    if (!data) {
      return NextResponse.json({ error: "Onboarding not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load onboarding dashboard", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
