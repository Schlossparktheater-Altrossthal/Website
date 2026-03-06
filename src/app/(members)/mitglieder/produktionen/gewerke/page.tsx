import { Building2, ClipboardList, LayoutTemplate, Users } from "lucide-react";

import { PageHeader } from "@/components/members/page-header";
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

  const departmentCount = activeProduction
    ? await prisma.department.count({ where: { productionId: activeProduction.id } })
    : 0;

  const openTaskCount = activeProduction
    ? await prisma.departmentTask.count({
        where: {
          department: { productionId: activeProduction.id },
          status: { in: ["todo", "doing"] },
        },
      })
    : 0;

  const memberCount = activeProduction
    ? await prisma.departmentMembership.count({
        where: {
          department: { productionId: activeProduction.id },
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
        description="Grundlayout ist aktiv. Hier kannst du die neue Ansicht für Allgemeines aufbauen."
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
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4" aria-hidden />
                Neue Ansicht vorbereiten
              </CardTitle>
              <p className="text-sm text-muted-foreground">Dieser Bereich enthält absichtlich nur die Grunddaten und ein neutrales Layout als Ausgangspunkt für dein neues Design.</p>
            </CardHeader>
          </Card>
        </>
      )}
    </div>
  );
}
