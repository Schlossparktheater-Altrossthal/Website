import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import {
  getAvailableOnboardings,
  getOnboardingDashboardData,
} from "@/lib/onboarding/dashboard-service";

import { DashboardClient } from "./_components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function OnboardingDashboardPage({
  params,
}: {
  params: Promise<{ onboardingId: string }>;
}) {
  const resolvedParams = await params;
  const onboardingId = resolvedParams?.onboardingId;

  if (!onboardingId) {
    notFound();
  }

  const [availableOnboardings, dashboard] = await Promise.all([
    getAvailableOnboardings(),
    getOnboardingDashboardData(onboardingId),
  ]);

  if (!dashboard) {
    notFound();
  }

  const options = availableOnboardings.length
    ? availableOnboardings
    : [
        {
          id: onboardingId,
          title: dashboard.onboarding.title,
          periodLabel: dashboard.onboarding.timeSpan,
          status: dashboard.onboarding.status,
        },
      ];

  return (
    <main id="main" className="space-y-6 pb-12">
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        <DashboardClient onboardings={options} initialData={dashboard} />
      </Suspense>
    </main>
  );
}
