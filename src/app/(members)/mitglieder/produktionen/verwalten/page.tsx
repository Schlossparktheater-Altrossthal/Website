import { redirect } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { getActiveProductionId } from "@/lib/active-production";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { ProductionsManager } from "./productions-manager";

/** Alle Produktionen verwalten (docs/Plan/produktionen-wechsler-plan.md, Schritt 2). */
export default async function ProduktionenVerwaltenPage({
  searchParams,
}: {
  searchParams: Promise<{ neu?: string }>;
}) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"))) {
    redirect("/mitglieder/produktionen");
  }
  const [{ neu }, activeId, shows] = await Promise.all([
    searchParams,
    getActiveProductionId(session.user?.id, { canManageProductions: true }),
    prisma.show.findMany({
      orderBy: { year: "desc" },
      select: {
        id: true,
        year: true,
        title: true,
        synopsis: true,
        dates: true,
        revealedAt: true,
        premiereAt: true,
        status: true,
        _count: { select: { memberships: true } },
      },
    }),
  ]);
  const currentYear = new Date().getFullYear();
  const highest = shows[0]?.year ?? currentYear - 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produktionen verwalten"
        description="Anlegen, Status ändern und Stammdaten pflegen. Welche Produktion du siehst, wählst du oben in der Seitenleiste."
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/produktionen")]}
      />
      <ProductionsManager
        shows={shows.map(({ _count, ...show }) => ({
          ...show,
          revealedAt: show.revealedAt?.toISOString() ?? null,
          premiereAt: show.premiereAt?.toISOString() ?? null,
          memberCount: _count.memberships,
        }))}
        activeShowId={activeId}
        suggestedYear={highest >= currentYear ? highest + 1 : currentYear}
        openCreate={neu === "1"}
      />
    </div>
  );
}
