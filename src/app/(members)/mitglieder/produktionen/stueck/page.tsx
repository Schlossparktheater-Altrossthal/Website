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
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

import { StueckRequestView } from "./request-view";
import { SkriptView } from "./skript/skript-view";
import { StueckClient, StueckNav, type StueckView } from "./stueck-client";

const PATH = "/mitglieder/produktionen/stueck";

type PageProps = { searchParams: Promise<{ ansicht?: string; fassung?: string }> };

const VIEWS: readonly StueckView[] = ["ablauf", "rollen", "auftritte", "skript"];

/** Das Stück: Ablauf (Akte und Szenen), Rollen und Auftrittsplan einer Produktion. */
export default async function StueckPage({ searchParams }: PageProps) {
  const { ansicht, fassung } = await searchParams;
  const view: StueckView = VIEWS.find((v) => v === ansicht) ?? "ablauf";
  const session = await requireAuth();
  const breadcrumbs = [membersNavigationBreadcrumb(PATH)];

  const [canManage, canRequest] = await Promise.all([
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
    hasPermission(session.user, REQUIREMENT_CREATE_PERMISSION),
  ]);

  if (view === "skript") {
    // Skript: Lesen dürfen alle Mitglieder (freigegebene Fassungen), Verwalten Regie/Board.
    const production = await getActiveProduction(session.user?.id);
    const [canRead, canManageScript] = production
      ? await Promise.all([
          hasPermission(session.user, SCRIPT_READ_PERMISSION, { showId: production.id }),
          hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId: production.id }),
        ])
      : [false, false];
    return (
      <div className="space-y-4">
        {canManage ? (
          <ProductionHeader production={production} active="stueck" canManage />
        ) : (
          <PageHeader title="Skript" breadcrumbs={breadcrumbs} />
        )}
        {canManage ? <StueckNav view="skript" /> : null}
        {!production ? (
          <ProductionWorkspaceEmptyState
            title="Keine Produktion ausgewählt"
            description="Wähle oben eine Produktion aus, um ihr Skript zu sehen."
          />
        ) : canRead || canManageScript ? (
          <SkriptView
            showId={production.id}
            versionId={fassung ?? null}
            canManage={canManageScript}
          />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Für das Skript fehlt dir die Berechtigung.
          </p>
        )}
      </div>
    );
  }

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
          title="Keine Produktion ausgewählt"
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
