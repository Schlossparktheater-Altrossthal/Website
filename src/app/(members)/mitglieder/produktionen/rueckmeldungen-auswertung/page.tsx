import Link from "next/link";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { Button } from "@/components/ui/button";
import { ProductionWorkspaceHeader } from "@/components/production/workspace-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";

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
  const headerActions = (
    <Button asChild variant="outline" size="sm">
      <Link href="/mitglieder/produktionen">Zum Überblick</Link>
    </Button>
  );

  if (!activeProduction) {
    return (
      <div className="space-y-6">
        <ProductionWorkspaceHeader
          title="Rückmeldungen & Auswertung"
          description="Analysiere bald Rückmeldungen und Auswertungen deiner Produktion gebündelt an einem Ort."
          activeWorkspace="feedback"
          production={null}
          actions={headerActions}
        />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle im Produktionsüberblick eine aktive Produktion aus, um Rückmeldungen auszuwerten."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProductionWorkspaceHeader
        title="Rückmeldungen & Auswertung"
        description="Hier entsteht neues. Bald findest du Kennzahlen, Feedback und Statistiken zur aktuellen Produktion."
        activeWorkspace="feedback"
        production={activeProduction}
        actions={headerActions}
      />

      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Hier entsteht neues.
      </div>
    </div>
  );
}
