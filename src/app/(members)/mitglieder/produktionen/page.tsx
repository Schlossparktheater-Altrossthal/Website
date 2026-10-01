import { Suspense } from "react";
import Link from "next/link";

import { ProductionHeader } from "@/components/production/production-header";
import { Button } from "@/components/ui/button";
import { getActiveProduction } from "@/lib/active-production";
import { hasPermission } from "@/lib/permissions";
import { canViewPlan, loadProductionPlan } from "@/lib/planning/plan-service";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { PlanView } from "./_plan/plan-view";
import { MANAGE_PARAM, ProductionManageSheet } from "./production-manage-sheet";

/** Produktionsseite, Tab „Plan“ (docs/Plan/projektplanung-plan.md). */
export default async function ProduktionenPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const [canManage, production] = await Promise.all([
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
    getActiveProduction(userId),
  ]);

  const manageSheet = canManage ? await renderManageSheet(production?.id ?? null) : null;

  if (!production) {
    return (
      <div className="space-y-6">
        <ProductionHeader production={null} active="plan" canManage={canManage} />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">Keine aktive Produktion ausgewählt.</p>
          {canManage ? (
            <Button asChild>
              <Link href={`/mitglieder/produktionen?${MANAGE_PARAM}=1`}>
                Produktionen verwalten
              </Link>
            </Button>
          ) : null}
        </div>
        {manageSheet}
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

  const plan = await loadProductionPlan(production.id, session.user);

  return (
    <div className="space-y-6">
      <ProductionHeader production={production} active="plan" canManage={canManage} />
      {plan ? <PlanView plan={plan} /> : null}
      {manageSheet}
    </div>
  );
}

async function renderManageSheet(activeShowId: string | null) {
  const shows = await prisma.show.findMany({
    orderBy: { year: "desc" },
    select: {
      id: true,
      year: true,
      title: true,
      synopsis: true,
      dates: true,
      revealedAt: true,
      status: true,
    },
  });
  const currentYear = new Date().getFullYear();
  const highest = shows[0]?.year ?? currentYear - 1;
  return (
    <Suspense>
      <ProductionManageSheet
        shows={shows.map((show) => ({
          ...show,
          revealedAt: show.revealedAt ? show.revealedAt.toISOString() : null,
        }))}
        activeShowId={activeShowId}
        suggestedYear={highest >= currentYear ? highest + 1 : currentYear}
      />
    </Suspense>
  );
}
