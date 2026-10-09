import { Suspense } from "react";

import { PageHeader } from "@/components/members/page-header";
import { ProductionHeader } from "@/components/production/production-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";
import { getActiveProduction } from "@/lib/active-production";
import { REQUIREMENT_CREATE_PERMISSION } from "@/lib/ausstattung/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { hasPermission } from "@/lib/permissions";
import { loadRolesAndScenes } from "@/lib/produktionen/roles-scenes";
import { requireAuth } from "@/lib/rbac";

import { StueckRequestView } from "./request-view";
import { StueckClient, type StueckView } from "./stueck-client";

const PATH = "/mitglieder/produktionen/stueck";

type PageProps = { searchParams: Promise<{ ansicht?: string }> };

/** Das Stück: Ablauf (Akte und Szenen), Rollen und Auftrittsplan einer Produktion. */
export default async function StueckPage({ searchParams }: PageProps) {
  const { ansicht } = await searchParams;
  const view: StueckView = ansicht === "rollen" || ansicht === "auftritte" ? ansicht : "ablauf";
  const session = await requireAuth();
  const breadcrumbs = [membersNavigationBreadcrumb(PATH)];

  const [canManage, canRequest] = await Promise.all([
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
    hasPermission(session.user, REQUIREMENT_CREATE_PERMISSION),
  ]);

  if (!canManage && canRequest) {
    const production = await getActiveProduction(session.user?.id);
    if (production) {
      return (
        <div className="space-y-4">
          <PageHeader
            title={`Stück · ${production.title ?? production.year}`}
            breadcrumbs={breadcrumbs}
          />
          <StueckRequestView data={await loadRolesAndScenes(production.id, { canRequest })} />
        </div>
      );
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stück" breadcrumbs={breadcrumbs} />
        <p className="py-12 text-center text-sm text-muted-foreground">
          Rollen und Szenen verwalten Regie und Board.
        </p>
      </div>
    );
  }

  const production = await getActiveProduction(session.user?.id);
  if (!production) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stück" breadcrumbs={breadcrumbs} />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle oben eine Produktion aus, um Szenen und Rollen zu planen."
        />
      </div>
    );
  }

  const data = await loadRolesAndScenes(production.id, { canRequest });

  return (
    <div className="space-y-4">
      <ProductionHeader production={production} active="stueck" canManage />
      <Suspense>
        <StueckClient data={data} view={view} />
      </Suspense>
    </div>
  );
}
