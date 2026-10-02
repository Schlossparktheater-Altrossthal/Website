import { ProductionHeader } from "@/components/production/production-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { ProgressRing } from "@/components/ui/progress-ring";
import { getActiveProduction } from "@/lib/active-production";
import { hasPermission } from "@/lib/permissions";
import { canViewPlan } from "@/lib/planning/plan-service";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { DeadlineBadge } from "@/components/production/deadline-badge";

/** Übersicht aller Gewerke der aktiven Produktion mit Fortschritt und nächster Frist. */
export default async function ProduktionGewerkePage() {
  const session = await requireAuth();
  const production = await getActiveProduction(session.user?.id);
  const canManage = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");

  if (!production) {
    return (
      <div className="space-y-6">
        <ProductionHeader production={null} active="gewerke" canManage={canManage} />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle in der Seitenleiste eine Produktion aus."
        />
      </div>
    );
  }
  if (!(await canViewPlan(session.user, production.id))) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Du gehörst nicht zu dieser Produktion.
      </p>
    );
  }

  const now = new Date();
  const departments = await prisma.department.findMany({
    where: { showId: production.id, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      color: true,
      _count: { select: { memberships: { where: { status: "active" } } } },
      // Fortschritt zählt nur Karten, die an einem Meilenstein des Plans hängen.
      tasks: { where: { milestoneId: { not: null } }, select: { status: true } },
      milestones: {
        where: { doneAt: null, dueAt: { not: null } },
        orderBy: { dueAt: "asc" },
        take: 1,
        select: { title: true, dueAt: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <ProductionHeader production={production} active="gewerke" canManage={canManage} />
      {departments.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Für diese Produktion gibt es noch keine Gewerke.
        </p>
      ) : (
        <ListRowGroup variant="inset" className="bg-card">
          {departments.map((department) => {
            const total = department.tasks.length;
            const done = department.tasks.filter((task) => task.status === "done").length;
            const next = department.milestones[0];
            const members = department._count.memberships;
            return (
              <ListRow
                key={department.id}
                href={`/mitglieder/meine-gewerke/${department.slug}`}
                leading={
                  <ProgressRing
                    value={done}
                    max={Math.max(total, 1)}
                    size={40}
                    label={total ? `${done}/${total}` : "–"}
                  />
                }
                title={department.name}
                description={[
                  `${members} ${members === 1 ? "Person" : "Personen"}`,
                  total ? `${done}/${total} Karten im Plan` : "keine Karten im Plan",
                  next ? `nächste Frist: ${next.title}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={next?.dueAt ? <DeadlineBadge dueAt={next.dueAt} now={now} /> : null}
              />
            );
          })}
        </ListRowGroup>
      )}
    </div>
  );
}
