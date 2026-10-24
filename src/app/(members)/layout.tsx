import React from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { execSync } from "node:child_process";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MEMBERS_NAV_CLOSED_GROUPS_COOKIE, parseClosedNavGroups } from "@/lib/members-navigation";
import { MembersPermissionsProvider } from "@/components/members/permissions-context";
import { MembersAppShell } from "@/components/members/members-app-shell";
import { HiddenPageGuard } from "@/components/members/hidden-page-guard";
import { SidebarProvider, SIDEBAR_COOKIE_NAME } from "@/components/ui/sidebar";
import { getActiveProduction, getSwitchableProductions } from "@/lib/active-production";
import { prisma } from "@/lib/prisma";
import { currentDepartmentMembershipWhere } from "@/lib/produktionen/status";
import { getUserPermissionKeys } from "@/lib/permissions";
import { hasRole, requireAuth } from "@/lib/rbac";
import { readWebsiteSettingsCached, resolveWebsiteSettings } from "@/lib/website-settings";
import {
  isMemberPageHidden,
  PAGE_VISIBILITY_BYPASS_PERMISSION,
} from "@/lib/members-page-visibility";
import { DIRECTION_HOME_PATH, isDirectionViewPathAllowed } from "@/lib/regie/access";
import { DirectionViewGuard } from "@/components/members/direction-view-guard";
import { MEMBERS_PATHNAME_HEADER } from "@/proxy";

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
  const defaultSidebarOpen = typeof sidebarState === "undefined" ? true : sidebarState === "true";
  const closedNavGroups = parseClosedNavGroups(
    cookieStore.get(MEMBERS_NAV_CLOSED_GROUPS_COOKIE)?.value,
  );

  const session = await requireAuth();
  const userId = session.user?.id;
  // Alles Unabhängige gleichzeitig laden – jede Abfrage kostet eine Runde zur Datenbank.
  const [
    permissions,
    activeProduction,
    switchableProductions,
    websiteSettingsRecord,
    assignmentCounts,
    viewSettings,
  ] = await Promise.all([
    getUserPermissionKeys(session.user),
    getActiveProduction(session.user?.id),
    getSwitchableProductions(session.user?.id),
    process.env.DATABASE_URL
      ? readWebsiteSettingsCached().catch((error) => {
          console.error("Failed to load website settings", error);
          return null;
        })
      : Promise.resolve(null),
    userId
      ? Promise.all([
          prisma.eventParticipant.count({
            where: {
              userId,
              response: { not: null },
              event: { kind: "REHEARSAL", status: { not: "DRAFT" } },
            },
          }),
          prisma.departmentMembership.count({
            where: { userId, ...currentDepartmentMembershipWhere() },
          }),
          prisma.departmentMembership.count({
            where: { userId, role: "lead", ...currentDepartmentMembershipWhere() },
          }),
        ])
      : Promise.resolve([0, 0, 0] as const),
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { directionView: true } })
      : Promise.resolve(null),
  ]);
  const isBoard = hasRole(session.user, "board");

  const resolvedSettings = resolveWebsiteSettings(websiteSettingsRecord ?? null);
  const siteTitle = resolvedSettings.siteTitle;

  // In der Seitensteuerung ausgeblendete Seiten sind nur mit dem Pages-Recht erreichbar.
  const canBypassPageVisibility = permissions.includes(PAGE_VISIBILITY_BYPASS_PERMISSION);
  const pathname = (await headers()).get(MEMBERS_PATHNAME_HEADER);
  // Regie-Ansicht (docs/Plan/regie-plan.md): ohne Menü, alles läuft über das Regie-Dashboard.
  const directionView = viewSettings?.directionView === true;
  if (directionView && pathname && !isDirectionViewPathAllowed(pathname)) {
    redirect(DIRECTION_HOME_PATH);
  }
  if (
    pathname &&
    !canBypassPageVisibility &&
    isMemberPageHidden(pathname, resolvedSettings.pageVisibility.members)
  ) {
    redirect("/mitglieder");
  }

  const [, departmentAssignmentCount, leadAssignments] = assignmentCounts;
  const isDepartmentLead = leadAssignments > 0;
  const hasDepartmentMemberships = departmentAssignmentCount > 0;

  const layoutStyle = {
    ["--members-topbar-offset" as const]: "var(--header-height)",
  } as React.CSSProperties;

  return (
    <div className="app-shell bg-background">
      <SiteHeader
        siteTitle={siteTitle}
        activeProduction={activeProduction}
        membersMenu={!directionView}
      />
      <main className="relative z-10 flex min-h-0 min-w-0 flex-col pt-[var(--header-height)]">
        <SidebarProvider
          defaultOpen={defaultSidebarOpen}
          className="flex-1 min-h-0 bg-background"
          style={layoutStyle}
        >
          <MembersPermissionsProvider permissions={permissions}>
            {directionView ? <DirectionViewGuard /> : null}
            {canBypassPageVisibility ? null : (
              <HiddenPageGuard visibility={resolvedSettings.pageVisibility.members} />
            )}
            <MembersAppShell
              permissions={permissions}
              activeProduction={activeProduction ?? undefined}
              productions={switchableProductions}
              canManageProductions={permissions.includes("PRIVATE.PRODUCTION.SHOW.MANAGE")}
              hasDepartmentMemberships={hasDepartmentMemberships}
              isBoard={isBoard}
              isDepartmentLead={isDepartmentLead}
              impersonation={session.impersonation ?? null}
              pageVisibility={resolvedSettings.pageVisibility.members}
              closedNavGroups={closedNavGroups}
              directionView={directionView}
              globalFooter={
                <SiteFooter buildInfo={buildInfo} isAuthenticated={true} isDevBuild={isDevBuild} />
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
