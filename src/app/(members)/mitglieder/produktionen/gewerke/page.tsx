import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Users } from "lucide-react";

import { PageHeader } from "@/components/members/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveProduction } from "@/lib/active-production";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type OverviewStat = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Building2;
};

const currentPath = "/mitglieder/produktionen/gewerke";

export default async function ProduktionsGewerkePage() {
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
  const breadcrumbs = [membersNavigationBreadcrumb(currentPath)];

  const departmentCount = activeProduction
    ? await prisma.department.count()
    : 0;

  const openTaskCount = activeProduction
    ? await prisma.departmentTask.count({
        where: {
          status: { in: ["todo", "doing"] },
        },
      })
    : 0;

  const memberCount = activeProduction
    ? await prisma.departmentMembership.count({
        where: {},
      })
    : 0;

  const departments = activeProduction
    ? await prisma.department.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { memberships: true, tasks: true } },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const doneTaskCount = activeProduction
    ? await prisma.departmentTask.count({
        where: {
          status: "done",
        },
      })
    : 0;

  const stats: OverviewStat[] = [
    { label: "Gewerke", value: departmentCount.toString(), hint: "Aktive Teams in der Produktion", icon: Building2 },
    { label: "Mitglieder", value: memberCount.toString(), hint: "Zugeordnete Personen", icon: Users },
    { label: "Offene Aufgaben", value: openTaskCount.toString(), hint: "Todos in allen Gewerken", icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gewerke"
        description="Verwalte alle Gewerke der aktiven Produktion inklusive Teamgröße, Aufgaben und direktem Zugriff auf die Detailansicht."
        breadcrumbs={breadcrumbs}
      />

      {!activeProduction ? (
        <Card>
          <CardHeader>
            <CardTitle>Keine aktive Produktion</CardTitle>
            <p className="text-sm text-muted-foreground">Wähle eine aktive Produktion aus. Die Grundstruktur der Seite bleibt dabei erhalten.</p>
          </CardHeader>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardHeader className="pb-2">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <CardTitle className="text-2xl">{stat.value}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{stat.hint}</span>
                    <Icon className="h-4 w-4" aria-hidden />
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Gewerke der aktiven Produktion</CardTitle>
              <p className="text-sm text-muted-foreground">
                Abgeschlossen: {doneTaskCount} · Offen: {openTaskCount}
              </p>
            </CardHeader>
            <CardContent>
              {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Für die aktive Produktion sind noch keine Gewerke angelegt.
                </p>
              ) : (
                <ul className="space-y-3">
                  {departments.map((department) => (
                    <li key={department.id} className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <h2 className="text-base font-semibold text-foreground">{department.name}</h2>
                          <p className="text-sm text-muted-foreground">
                            {department.description?.trim() || "Keine Beschreibung hinterlegt."}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {department._count.memberships} Mitglieder · {department._count.tasks} Aufgaben
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="sm:ml-4">
                          <Link href={`/mitglieder/produktionen/gewerke/${department.id}`}>
                            Öffnen
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
