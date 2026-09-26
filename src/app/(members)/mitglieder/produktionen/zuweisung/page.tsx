import { PageHeader } from "@/components/members/page-header";
import { getActiveProduction } from "@/lib/active-production";
import { loadAssignmentData } from "@/lib/departments/assignments";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { AssignmentBoard } from "./assignment-board";

const currentPath = "/mitglieder/produktionen/zuweisung";

export default async function ZuweisungPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const isManager = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
  const leadDepartments = userId
    ? await prisma.departmentMembership.findMany({
        where: { userId, status: "active", role: "lead", department: { archivedAt: null } },
        select: { departmentId: true },
      })
    : [];

  if (!isManager && leadDepartments.length === 0) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Du hast keinen Zugriff auf die Zuweisung.
      </div>
    );
  }

  const activeProduction = await getActiveProduction(userId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Teams & Zuweisung"
        description={
          isManager
            ? "Wünsche aus dem Onboarding ansehen und Personen Gewerken oder Rollen zuweisen."
            : "Anfragen und Wünsche für die Gewerke, die du leitest."
        }
        breadcrumbs={[membersNavigationBreadcrumb(currentPath)]}
      />
      {activeProduction ? (
        <AssignmentBoard
          data={await loadAssignmentData(activeProduction.id)}
          manageAll={isManager}
          leadDepartmentIds={leadDepartments.map((entry) => entry.departmentId)}
        />
      ) : (
        <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
          Wähle zuerst eine aktive Produktion aus.
        </div>
      )}
    </div>
  );
}
