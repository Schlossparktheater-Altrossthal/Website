import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getOnboardingDashboardData } from "@/lib/onboarding/dashboard-service";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import {
  buildCandidateAggregates,
  getCandidateHighlight,
  getPrimaryCandidateHighlight,
} from "@/app/dashboard/onboarding/[onboardingId]/_components/ranking-data";
import type { HighlightContext } from "@/app/dashboard/onboarding/[onboardingId]/_components/ranking-types";
import { TalentDetailContent } from "@/app/dashboard/onboarding/[onboardingId]/talente/talent-detail-content";

export const dynamic = "force-dynamic";

const percentageFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

type MembersTalentDetailPageProps = {
  params: Promise<{ onboardingId: string; userId: string }>;
  searchParams?: Promise<{ roleId?: string }>;
};

function HighlightSummary({ highlight }: { highlight: HighlightContext | null }) {
  if (!highlight) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
      <Badge variant="muted" size="sm" className="font-semibold uppercase tracking-wide">
        {highlight.label}
      </Badge>
      <Badge variant="outline" size="sm">#{highlight.rank}</Badge>
      <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-medium text-foreground/80">
        {percentageFormatter.format(highlight.share * 100)}% Präferenzanteil
      </span>
    </div>
  );
}

export default async function MembersTalentDetailPage({
  params,
  searchParams,
}: MembersTalentDetailPageProps) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.onboarding.analytics");

  if (!allowed) {
    redirect("/mitglieder");
  }

  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const onboardingId = resolvedParams?.onboardingId;
  const userId = resolvedParams?.userId;
  const requestedRoleId = resolvedSearchParams?.roleId ?? null;

  if (!onboardingId || !userId) {
    notFound();
  }

  const dashboard = await getOnboardingDashboardData(onboardingId);

  if (!dashboard) {
    notFound();
  }

  const candidateMap = buildCandidateAggregates(dashboard.ranking);
  const candidate = candidateMap.get(userId);

  if (!candidate) {
    notFound();
  }

  const highlightFromRole = requestedRoleId
    ? getCandidateHighlight(dashboard.ranking, requestedRoleId, userId)
    : null;
  const highlight = highlightFromRole ?? getPrimaryCandidateHighlight(dashboard.ranking, userId);

  const backHref = `/mitglieder/onboarding?onboardingId=${encodeURIComponent(onboardingId)}`;

  return (
    <div id="main" className="space-y-6">
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zurück zur Onboarding-Analyse
        </Link>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Onboarding Ranking</span>
            {dashboard.onboarding.timeSpan ? (
              <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium normal-case">
                {dashboard.onboarding.timeSpan}
              </span>
            ) : null}
            <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium normal-case">
              {dashboard.onboarding.participants} Teilnehmende
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {candidate.name}
          </h1>
          <p className="text-sm text-muted-foreground">{dashboard.onboarding.title}</p>
          <HighlightSummary highlight={highlight} />
        </div>
      </div>

      <TalentDetailContent candidate={candidate} />
    </div>
  );
}
