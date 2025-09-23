import React from "react";
import { cookies } from "next/headers";
import { execSync } from "node:child_process";

import { MysticBackground } from "@/components/mystic-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { AssignmentFocus } from "@/components/members-nav";
import { MembersPermissionsProvider } from "@/components/members/permissions-context";
import { MembersAppShell } from "@/components/members/members-app-shell";
import { SidebarProvider, SIDEBAR_COOKIE_NAME } from "@/components/ui/sidebar";
import { getActiveProduction } from "@/lib/active-production";
import { prisma } from "@/lib/prisma";
import { getUserPermissionKeys } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { readWebsiteSettings, resolveWebsiteSettings } from "@/lib/website-settings";

type CommitInfo = {
  short: string;
  full: string;
};

type BuildInfo = {
  commit: CommitInfo | null;
  timestamp: string;
  isoTimestamp: string;
};

function getBuildInfo(): BuildInfo {
  const buildDate = new Date();
  const timestamp = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(buildDate);
  const isoTimestamp = buildDate.toISOString();

  const commit = getCommitInfo();

  return {
    commit,
    timestamp,
    isoTimestamp,
  } satisfies BuildInfo;
}

function getCommitInfo(): CommitInfo | null {
  const envCommit =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.COMMIT_REF ??
    null;

  if (envCommit) {
    const normalizedCommit = envCommit.trim();

    return {
      short: normalizedCommit.slice(0, 7),
      full: normalizedCommit,
    } satisfies CommitInfo;
  }

  try {
    const fullCommitHash = execSync("git rev-parse HEAD").toString().trim();

    return {
      short: fullCommitHash.slice(0, 7),
      full: fullCommitHash,
    } satisfies CommitInfo;
  } catch {
    return null;
  }
}

const buildInfo = getBuildInfo();
const isDevBuild = process.env.NODE_ENV === "development";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
  const defaultSidebarOpen =
    typeof sidebarState === "undefined" ? true : sidebarState === "true";

  const session = await requireAuth();
  const permissions = await getUserPermissionKeys(session.user);
  const activeProduction = await getActiveProduction();

  let resolvedSettings = resolveWebsiteSettings(null);

  if (process.env.DATABASE_URL) {
    try {
      const record = await readWebsiteSettings();
      if (record) {
        resolvedSettings = resolveWebsiteSettings(record);
      }
    } catch (error) {
      console.error("Failed to load website settings", error);
    }
  }

  const siteTitle = resolvedSettings.siteTitle;

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

  const layoutStyle = {
    ["--members-topbar-offset" as const]: "var(--header-height)",
  } as React.CSSProperties;

  return (
    <div className="app-shell bg-background">
      <MysticBackground />
      <SiteHeader siteTitle={siteTitle} />
      <main className="relative z-10 flex min-h-0 flex-col pt-[var(--header-height)]">
        <SidebarProvider
          defaultOpen={defaultSidebarOpen}
          className="flex-1 min-h-0 bg-background"
          style={layoutStyle}
        >
          <MembersPermissionsProvider permissions={permissions}>
            <MembersAppShell
              permissions={permissions}
              activeProduction={activeProduction ?? undefined}
              assignmentFocus={assignmentFocus}
              hasDepartmentMemberships={hasDepartmentMemberships}
              globalFooter={
                <SiteFooter
                  buildInfo={buildInfo}
                  isDevBuild={isDevBuild}
                  siteTitle={siteTitle}
                />
              }
            >
              {children}
            </MembersAppShell>
          </MembersPermissionsProvider>
        </SidebarProvider>
      </main>
    </div>
  );
}

