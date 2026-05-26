import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarDays, FolderOpen, Wrench } from "lucide-react";

import { PageHeader } from "@/components/members/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasRole, requireAuth } from "@/lib/rbac";

type StatItem = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Building2;
};

export default async function MeineGewerkePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.DEPARTMENT.OWN.VIEW");
  const isBoard = hasRole(session.user, "board");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Gewerkeübersicht.</div>
      </div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  if (!isBoard) {
    const leadCount = await prisma.departmentMembership.count({ where: { userId, role: "lead" } });
    if (leadCount === 0) {
      return (
        <div className="space-y-6">
          <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Gewerkeübersicht.</div>
        </div>
      );
    }
  }

  const memberships = await prisma.departmentMembership.findMany({
    where: { userId },
    select: {
      department: {
        select: {
          id: true,
          slug: true,
          tasks: { select: { id: true, status: true } },
          events: { select: { id: true } },
          documents: { select: { id: true } },
        },
      },
    },
  });

  const teamCount = memberships.length;
  const allTasks = memberships.flatMap((entry) => entry.department.tasks);
  const openTasks = allTasks.filter((task) => task.status !== "done").length;
  const eventCount = memberships.reduce((sum, entry) => sum + entry.department.events.length, 0);
  const documentCount = memberships.reduce((sum, entry) => sum + entry.department.documents.length, 0);

  const stats: StatItem[] = [
    { label: "Gewerke", value: teamCount.toString(), hint: "Teams mit Zugriff", icon: Wrench },
    { label: "Offene Aufgaben", value: openTasks.toString(), hint: "Todos in deinen Gewerken", icon: Wrench },
    { label: "Termine", value: eventCount.toString(), hint: "Ereignisse in den Teams", icon: CalendarDays },
    { label: "Dokumente", value: documentCount.toString(), hint: "Dateien aus den Gewerken", icon: FolderOpen },
  ];

  const firstDepartmentSlug = memberships.find((entry) => entry.department.slug)?.department.slug;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gewerkeplanung"
        description="Die alte Ansicht wurde entfernt. Hier steht eine schlanke Basis für dein neues Design bereit."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          <CardTitle>Neue Oberfläche vorbereiten</CardTitle>
          <p className="text-sm text-muted-foreground">Nutze diese Seite als Ausgangspunkt. Authentifizierung, Berechtigungen und Datenanbindung bleiben aktiv.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/mitglieder/meine-gewerke/todos">Aufgaben öffnen</Link>
          </Button>
          {firstDepartmentSlug ? (
            <Button asChild variant="outline">
              <Link href={`/mitglieder/meine-gewerke/${encodeURIComponent(firstDepartmentSlug)}`}>Erstes Gewerk öffnen</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
