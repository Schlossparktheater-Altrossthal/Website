import { withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";

import { collectOnboardingAnalytics } from "@/lib/onboarding-analytics";

export const GET = withRoute(
  { name: "onboarding/analytics.get", permission: "PRIVATE.ADMIN.ONBOARDING.ANALYTICS" },
  async () => {
    const data = await collectOnboardingAnalytics();
    const response = NextResponse.json({ analytics: data });
    if (data.offline) {
      response.headers.set("X-Analytics-Mode", "offline");
    }
    return response;
  },
);
