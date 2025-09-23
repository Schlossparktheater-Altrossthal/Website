"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarInset,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { MembersNav, type AssignmentFocus } from "@/components/members-nav";

interface MembersAppShellProps {
  children: React.ReactNode;
  permissions: readonly string[];
  activeProduction?: { id: string; title: string | null; year: number };
  assignmentFocus: AssignmentFocus;
  hasDepartmentMemberships: boolean;
}

function SidebarMobileAutoClose() {
  const pathname = usePathname();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    if (isMobile && openMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, openMobile, pathname, setOpenMobile]);

  return null;
}

export function MembersAppShell({
  children,
  permissions,
  activeProduction,
  assignmentFocus,
  hasDepartmentMemberships,
}: MembersAppShellProps) {
  return (
    <>
      <SidebarMobileAutoClose />
      <Sidebar collapsible="icon">
        <MembersNav
          permissions={permissions}
          activeProduction={activeProduction}
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
    </>
  );
}
