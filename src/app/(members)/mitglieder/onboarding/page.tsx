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

type MembersOnboardingAnalyticsPageProps = {
  searchParams?: Promise<{ onboardingId?: string }>;
};

export default async function MembersOnboardingAnalyticsPage({
  searchParams,
}: MembersOnboardingAnalyticsPageProps) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.onboarding.analytics");

  if (!allowed) {
    redirect("/mitglieder");
  }

  const [availableOnboardings, resolvedSearchParams] = await Promise.all([
    getAvailableOnboardings(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const requestedOnboardingId = resolvedSearchParams?.onboardingId;
  const availableIds = new Set(availableOnboardings.map((onboarding) => onboarding.id));
  const initialOnboarding = availableOnboardings[0];

  const selectedOnboardingId = requestedOnboardingId && availableIds.has(requestedOnboardingId)
    ? requestedOnboardingId
    : initialOnboarding?.id;

  if (!selectedOnboardingId) {
    notFound();
  }

  const dashboard = await getOnboardingDashboardData(selectedOnboardingId);

  if (!dashboard) {
    notFound();
  }

  const options = availableOnboardings.length
    ? availableOnboardings
    : [
        {
          id: selectedOnboardingId,
          title: dashboard.onboarding.title,
          periodLabel: dashboard.onboarding.timeSpan,
          status: dashboard.onboarding.status,
        },
      ];

  return (
    <main id="main" className="space-y-6 pb-12">
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        <DashboardClient
          onboardings={options}
          initialData={dashboard}
          navigateHrefTemplate="/mitglieder/onboarding?onboardingId=%s"
        />
      </Suspense>
    </main>
  );
}
