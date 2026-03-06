import { notFound } from "next/navigation";
import { ClipboardCheck, ListTodo, Users } from "lucide-react";

import { PageHeader } from "@/components/members/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type TodoStat = {
  label: string;
  value: string;
  hint: string;
  icon: typeof ListTodo;
};

export default async function DepartmentTodosPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.meine-gewerke");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-red-600">Kein Zugriff auf die Gewerke-Aufgabenübersicht.</div>
      </div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const memberships = await prisma.departmentMembership.findMany({
    where: { userId },
    select: {
      id: true,
      department: {
        select: {
          tasks: {
            select: {
              id: true,
              status: true,
              assignments: { select: { userId: true } },
            },
          },
        },
      },
    },
  });

  const allTasks = memberships.flatMap((entry) => entry.department.tasks);
  const openTasks = allTasks.filter((task) => task.status !== "done").length;
  const assignedToMe = allTasks.filter((task) => task.assignments.some((assignment) => assignment.userId === userId));
  const openAssignedToMe = assignedToMe.filter((task) => task.status !== "done").length;

  const stats: TodoStat[] = [
    { label: "Teams", value: memberships.length.toString(), hint: "Gewerke mit Aufgaben", icon: Users },
    { label: "Offene Aufgaben", value: openTasks.toString(), hint: "Alle offenen Todos", icon: ListTodo },
    { label: "Meine offenen Aufgaben", value: openAssignedToMe.toString(), hint: "Direkt zugewiesen", icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aufgaben"
        description="Die alte Aufgabenansicht wurde entfernt. Diese Basis bleibt bewusst schlank für dein neues Design."
      />

      <section className="grid gap-3 md:grid-cols-3">
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
          <CardTitle>Arbeitsfläche für neue Aufgaben-UI</CardTitle>
          <p className="text-sm text-muted-foreground">Datenzugriff und Berechtigungen funktionieren weiterhin. Ersetze diesen Platzhalter Schritt für Schritt durch dein neues Layout.</p>
        </CardHeader>
      </Card>
    </div>
  );
}
