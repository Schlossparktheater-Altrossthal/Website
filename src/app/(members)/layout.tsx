import React from "react";
import { MembersNav, type AssignmentFocus } from "@/components/members-nav";
import { MembersPermissionsProvider } from "@/components/members/permissions-context";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/rbac";
import { getUserPermissionKeys } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { prisma } from "@/lib/prisma";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
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
    <MembersPermissionsProvider permissions={permissions}>
      <SidebarProvider>
        <div className="flex min-h-svh w-full">
          <Sidebar collapsible="icon">
            <MembersNav
              permissions={permissions}
              activeProduction={activeProduction ?? undefined}
              assignmentFocus={assignmentFocus}
              hasDepartmentMemberships={hasDepartmentMemberships}
            />
            <SidebarRail />
          </Sidebar>
          <SidebarInset>
            <div className="flex min-h-svh flex-col">
              <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
                <SidebarTrigger className="-ml-1 text-foreground/80 hover:text-foreground" />
                <div className="text-sm font-semibold text-foreground">Mitgliederbereich</div>
              </header>
              <div className="flex-1 pb-12 pt-6 sm:pt-8">
                <div className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
                  {children}
                </div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </MembersPermissionsProvider>
  );
}

