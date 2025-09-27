import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import {
  getAvailableOnboardings,
  getOnboardingDashboardData,
} from "@/lib/onboarding/dashboard-service";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { DashboardClient } from "@/app/dashboard/onboarding/[onboardingId]/_components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function MembersOnboardingAnalyticsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.onboarding.analytics");

  if (!allowed) {
    redirect("/mitglieder");
  }

  const availableOnboardings = await getAvailableOnboardings();
  const initialOnboarding = availableOnboardings[0];

  if (!initialOnboarding) {
    notFound();
  }

  const dashboard = await getOnboardingDashboardData(initialOnboarding.id);

  if (!dashboard) {
    notFound();
  }

  if (availableOnboardings.length === 1) {
    redirect(`/dashboard/onboarding/${initialOnboarding.id}`);
  }

  const options = availableOnboardings.length
    ? availableOnboardings
    : [
        {
          id: initialOnboarding.id,
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
