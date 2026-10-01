import { ProductionHeader } from "@/components/production/production-header";
import { getActiveProduction } from "@/lib/active-production";
import { loadAssignmentData } from "@/lib/departments/assignments";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { loadRolesAndScenes } from "@/lib/produktionen/roles-scenes";
import { requireAuth } from "@/lib/rbac";

import { AssignmentBoard } from "./assignment-board";

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
      <ProductionHeader
        production={activeProduction}
        active="zuweisung"
        canManage={isManager}
        extraTabs={["zuweisung"]}
      />
      {activeProduction ? (
        <AssignmentBoard
          data={await loadAssignmentData(activeProduction.id)}
          rolesData={isManager ? await loadRolesAndScenes(activeProduction.id) : null}
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
