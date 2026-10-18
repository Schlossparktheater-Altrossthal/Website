import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductionHeader } from "@/components/production/production-header";
import { Button } from "@/components/ui/button";
import { getActiveProduction } from "@/lib/active-production";
import { hasPermission } from "@/lib/permissions";
import { canViewPlan, loadProductionPlan } from "@/lib/planning/plan-service";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { PlanView } from "./_plan/plan-view";
import type { PlanTemplateSummary } from "./_plan/templates-panel";
import { SUGGESTED_TEMPLATE } from "@/lib/planning/templates";

/** Produktionsseite, Tab „Plan“ (docs/Plan/projektplanung-plan.md). */
export default async function ProduktionenPage({
  searchParams,
}: {
  searchParams: Promise<{ verwalten?: string; neu?: string }>;
}) {
  // Frühere Adresse des Verwalten-Fensters (Lesezeichen, Benachrichtigungen).
  const { verwalten, neu } = await searchParams;
  if (verwalten === "1") {
    redirect(`/mitglieder/produktionen/verwalten${neu === "1" ? "?neu=1" : ""}`);
  }
  const session = await requireAuth();
  const userId = session.user?.id;
  const [canManage, production] = await Promise.all([
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
    getActiveProduction(userId),
  ]);

  if (!production) {
    return (
      <div className="space-y-6">
        <ProductionHeader production={null} active="plan" canManage={canManage} />
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">Keine Produktion ausgewählt.</p>
          {canManage ? (
            <Button asChild>
              <Link href="/mitglieder/produktionen/verwalten">Produktionen verwalten</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!canManage && !(await canViewPlan(session.user, production.id))) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Du gehörst nicht zu dieser Produktion.
      </p>
    );
  }

  const [plan, storedTemplates] = await Promise.all([
    loadProductionPlan(production.id, session.user),
    prisma.planTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, items: true },
    }),
  ]);
  const templates: PlanTemplateSummary[] = [
    ...storedTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      count: Array.isArray(template.items) ? template.items.length : 0,
      builtIn: false,
    })),
    {
      id: SUGGESTED_TEMPLATE.id,
      name: SUGGESTED_TEMPLATE.name,
      count: SUGGESTED_TEMPLATE.items.length,
      builtIn: true,
    },
  ];

  return (
    <div className="space-y-6">
      <ProductionHeader production={production} active="plan" canManage={canManage} />
      {plan ? (
        <PlanView plan={plan} templates={templates} templateName={`Ablauf ${production.year}`} />
      ) : null}
    </div>
  );
}
