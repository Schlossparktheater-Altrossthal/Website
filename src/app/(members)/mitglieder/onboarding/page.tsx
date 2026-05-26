import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AlertIcon } from "@/components/ui/action-icons";

import { Skeleton } from "@/components/ui/skeleton";
import {
  getAvailableOnboardings,
  getOnboardingDashboardData,
} from "@/lib/onboarding/dashboard-service";
import { DEV_ONBOARDING_DASHBOARD, DEV_ONBOARDING_SUMMARY } from "@/lib/onboarding/dashboard-dev-fixture";
import { collectOnboardingAnalytics } from "@/lib/onboarding-analytics";
import { databaseEnabled } from "@/lib/dev-database";
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
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.ONBOARDING.ANALYTICS");

  if (!allowed) {
    redirect("/mitglieder");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const dbConfigured = databaseEnabled();
  let analyticsOffline = !dbConfigured;

  if (!analyticsOffline) {
    try {
      const analytics = await collectOnboardingAnalytics();
      analyticsOffline = analytics.offline === true;
    } catch (error) {
      console.error("[members:onboarding] Failed to collect onboarding analytics", error);
      analyticsOffline = true;
    }
  }

  let availableOnboardings = [] as Awaited<ReturnType<typeof getAvailableOnboardings>>;
  let selectedOnboardingId: string | null = null;
  let dashboard = null as Awaited<ReturnType<typeof getOnboardingDashboardData>>;

  if (!analyticsOffline) {
    try {
      availableOnboardings = await getAvailableOnboardings();
      const requestedOnboardingId = resolvedSearchParams?.onboardingId;
      const availableIds = new Set(availableOnboardings.map((onboarding) => onboarding.id));
      const initialOnboarding = availableOnboardings[0];

      const computedOnboardingId =
        requestedOnboardingId && availableIds.has(requestedOnboardingId)
          ? requestedOnboardingId
          : initialOnboarding?.id;

      if (!computedOnboardingId) {
        throw new Error("No onboarding data available");
      }

      selectedOnboardingId = computedOnboardingId;
      dashboard = await getOnboardingDashboardData(computedOnboardingId);

      if (!dashboard) {
        throw new Error(`Dashboard not found for onboarding ${computedOnboardingId}`);
      }
    } catch (error) {
      console.error("[members:onboarding] Failed to load live onboarding dashboard", error);
      analyticsOffline = true;
    }
  }

  if (analyticsOffline) {
    availableOnboardings = [DEV_ONBOARDING_SUMMARY];
    selectedOnboardingId = DEV_ONBOARDING_SUMMARY.id;
    dashboard = DEV_ONBOARDING_DASHBOARD;
  }

  if (!dashboard || !selectedOnboardingId) {
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
    <div id="main" className="space-y-6">
      {analyticsOffline ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 px-5 py-4 text-sm text-warning-foreground shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-warning/40 bg-warning/15">
              <AlertIcon className="h-5 w-5 text-warning" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-warning">Offline-Demo</p>
              <p className="text-sm text-warning-foreground/90">
                Die Onboarding-Analyse nutzt Demo-Daten, weil keine Datenbankverbindung verfügbar ist. Interaktive Auswertungen
                sind vorübergehend deaktiviert.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        <DashboardClient
          onboardings={options}
          initialData={dashboard}
          navigateHrefTemplate="/mitglieder/onboarding?onboardingId=%s"
          detailHrefTemplate="/mitglieder/onboarding/%s/talente/%s"
          isOffline={analyticsOffline}
        />
      </Suspense>
    </div>
  );
}
