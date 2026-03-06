import type { ReactNode } from "react";
import { Building2, ClipboardList, Users } from "lucide-react";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { PageHeader } from "@/components/members/page-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";

type HeaderStat = {
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
};

const currentPath = "/mitglieder/produktionen/gewerke";

function HeaderStats({ stats }: { stats: HeaderStat[] }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-br from-card/90 to-muted/50 px-4 py-3 shadow-sm"
          >
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold leading-tight text-foreground">{stat.value}</p>
              {stat.hint ? <p className="text-xs text-muted-foreground">{stat.hint}</p> : null}
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-card/80 text-muted-foreground">
              {stat.icon}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ProduktionsGewerkePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
          Du hast keinen Zugriff auf die Produktionsplanung.
        </div>
      </div>
    );
  }

  const activeProduction = await getActiveProduction(session.user?.id);
  const breadcrumbs = [membersNavigationBreadcrumb(currentPath)];

  if (!activeProduction) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Gewerke"
          description="Der Bereich Gewerke ist derzeit deaktiviert."
          breadcrumbs={breadcrumbs}
        />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle in der Produktionsübersicht eine aktive Produktion aus."
        />
      </div>
    );
  }

  const headerStats: HeaderStat[] = [
    {
      label: "Gewerke",
      value: "0",
      icon: <Building2 className="h-4 w-4" aria-hidden />,
      hint: "Aktuell werden keine Gewerke angezeigt.",
    },
    {
      label: "Mitglieder",
      value: "0",
      icon: <Users className="h-4 w-4" aria-hidden />,
      hint: "Keine Zuordnungen im deaktivierten Bereich.",
    },
    {
      label: "Aufgaben",
      value: "0",
      icon: <ClipboardList className="h-4 w-4" aria-hidden />,
      hint: "Keine Aufgaben im Bereich Gewerke.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gewerke"
        description="Der Bereich Gewerke ist derzeit deaktiviert."
        breadcrumbs={breadcrumbs}
      />

      <HeaderStats stats={headerStats} />

      <ProductionWorkspaceEmptyState
        title="Keine Gewerke verfügbar"
        description="Auf dieser Seite werden aktuell keine Gewerke angezeigt."
      />
    </div>
  );
}
