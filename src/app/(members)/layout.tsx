import React from "react";
import { cookies } from "next/headers";
import type { AssignmentFocus } from "@/components/members-nav";
import { MembersPermissionsProvider } from "@/components/members/permissions-context";
import { MembersAppShell } from "@/components/members/members-app-shell";
import { SidebarProvider, SIDEBAR_COOKIE_NAME } from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/rbac";
import { getUserPermissionKeys } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { prisma } from "@/lib/prisma";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
  const defaultSidebarOpen =
    typeof sidebarState === "undefined" ? true : sidebarState === "true";

  const session = await requireAuth();
  const permissions = await getUserPermissionKeys(session.user);
  const activeProduction = await getActiveProduction();

  let assignmentFocus: AssignmentFocus = "none";
  const userId = session.user?.id;
  let departmentAssignmentCount = 0;
  if (userId) {
    const [rehearsalAssignments, departmentAssignments] = await Promise.all([
      prisma.rehearsalAttendance.count({
        where: { userId, rehearsal: { status: { not: "DRAFT" } } },
      }),
      prisma.departmentMembership.count({ where: { userId } }),
    ]);

    departmentAssignmentCount = departmentAssignments;

    if (rehearsalAssignments > 0 && departmentAssignments > 0) {
      assignmentFocus = "both";
    } else if (departmentAssignments > 0) {
      assignmentFocus = "departments";
    } else if (rehearsalAssignments > 0) {
      assignmentFocus = "rehearsals";
    }
  }

  const hasDepartmentMemberships = departmentAssignmentCount > 0;

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="bg-background">
      <MembersPermissionsProvider permissions={permissions}>
        <MembersAppShell
          permissions={permissions}
          activeProduction={activeProduction ?? undefined}
          assignmentFocus={assignmentFocus}
          hasDepartmentMemberships={hasDepartmentMemberships}
        >
          {children}
        </MembersAppShell>
      </MembersPermissionsProvider>
    </SidebarProvider>
  );
}

