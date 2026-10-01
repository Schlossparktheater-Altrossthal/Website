import { ProductionHeader } from "@/components/production/production-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";
import { getActiveProduction } from "@/lib/active-production";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ProduktionsRueckmeldungenPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
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

  return (
    <div className="space-y-6">
      <ProductionHeader production={activeProduction} active="rueckmeldungen" canManage />
      {activeProduction ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Rückmeldungen und Auswertungen folgen.
        </p>
      ) : (
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle in der Seitenleiste eine Produktion aus."
        />
      )}
    </div>
  );
}
