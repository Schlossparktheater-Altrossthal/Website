import Link from "next/link";

import { PageHeader } from "@/components/members/page-header";
import { SectionNav } from "@/components/ui/section-nav";
import { loadLatestCriticalServerLogs } from "@/lib/analytics/load-server-logs";
import { loadMemberStatistics } from "@/lib/analytics/statistics";
import { USAGE_PERIODS, type UsagePeriod } from "@/lib/analytics/usage-summary";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { collectSystemResourceUsage } from "@/lib/server-analytics";
import { cn } from "@/lib/utils";

import { PerformanceSection } from "./performance-section";
import { StatisticsErrors } from "./statistics-errors";
import { StatisticsMembers } from "./statistics-members";
import { StatisticsOverview } from "./statistics-overview";
import { SystemSection } from "./system-section";

const AREAS = [
  { id: "uebersicht", label: "Übersicht" },
  { id: "mitglieder", label: "Mitglieder" },
  { id: "ladezeiten", label: "Ladezeiten" },
  { id: "fehler", label: "Fehler" },
  { id: "system", label: "System" },
] as const;
type AreaId = (typeof AREAS)[number]["id"];

const BASE_PATH = "/mitglieder/server-analytics";
const DEFAULT_PERIOD: UsagePeriod = 30;

function buildHref(area: AreaId, period: UsagePeriod) {
  const params = new URLSearchParams();
  if (area !== "uebersicht") params.set("ansicht", area);
  if (period !== DEFAULT_PERIOD) params.set("zeitraum", String(period));
  const query = params.toString();
  return query ? `${BASE_PATH}?${query}` : BASE_PATH;
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string; zeitraum?: string }>;
}) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.SERVER.ANALYTICS");
  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Statistik</div>;
  }

  const params = await searchParams;
  const area: AreaId = AREAS.some((entry) => entry.id === params.ansicht)
    ? (params.ansicht as AreaId)
    : "uebersicht";
  const requestedPeriod = Number(params.zeitraum);
  const period: UsagePeriod = USAGE_PERIODS.includes(requestedPeriod as UsagePeriod)
    ? (requestedPeriod as UsagePeriod)
    : DEFAULT_PERIOD;

  const periodSwitch = (
    <nav
      aria-label="Zeitraum"
      className="inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5"
    >
      {USAGE_PERIODS.map((days) => (
        <Link
          key={days}
          href={buildHref(area, days)}
          scroll={false}
          aria-current={days === period ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            days === period
              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {days} Tage
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistik"
        description="Wie der Mitgliederbereich genutzt wird, wie schnell er lädt und wo es hakt."
        actions={periodSwitch}
      />
      <SectionNav
        variant="underline"
        ariaLabel="Bereiche der Statistik"
        activeId={area}
        items={AREAS.map((entry) => ({
          id: entry.id,
          label: entry.label,
          href: buildHref(entry.id, period),
        }))}
      />
      <StatisticsArea area={area} period={period} />
    </div>
  );
}

async function StatisticsArea({ area, period }: { area: AreaId; period: UsagePeriod }) {
  if (area === "system") {
    const [resources, logs] = await Promise.all([
      collectSystemResourceUsage().catch(() => []),
      loadLatestCriticalServerLogs({ limit: 50, withinHours: period * 24 }),
    ]);
    return <SystemSection resources={resources} logs={logs} days={period} />;
  }

  const statistics = await loadMemberStatistics(period);
  switch (area) {
    case "mitglieder":
      return <StatisticsMembers statistics={statistics} />;
    case "ladezeiten":
      return <PerformanceSection summary={statistics.performance} />;
    case "fehler":
      return <StatisticsErrors statistics={statistics} />;
    default:
      return <StatisticsOverview statistics={statistics} />;
  }
}
