import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/members/page-header";
import { CastingExportDialog } from "@/components/production/casting-export-dialog";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";
import { getActiveProduction } from "@/lib/active-production";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { hasPermission } from "@/lib/permissions";
import { loadRolesAndScenes } from "@/lib/produktionen/roles-scenes";
import { requireAuth } from "@/lib/rbac";
import { cn } from "@/lib/utils";

import { RolesScenesClient } from "./roles-scenes-client";

const VIEWS = {
  rollen: { label: "Rollen", title: "Besetzung", href: "/mitglieder/produktionen/besetzung" },
  szenen: { label: "Szenen", title: "Szenen", href: "/mitglieder/produktionen/szenen" },
} as const;

/** Rollen- und Szenenverwaltung einer Produktion: zwei Ansichten, gleiche Daten. */
export async function RolesScenesPage({ view }: { view: keyof typeof VIEWS }) {
  const session = await requireAuth();
  const current = VIEWS[view];
  const breadcrumbs = [membersNavigationBreadcrumb(current.href)];

  if (!(await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"))) {
    return (
      <div className="space-y-6">
        <PageHeader title={current.title} breadcrumbs={breadcrumbs} />
        <p className="py-12 text-center text-sm text-muted-foreground">
          Rollen und Szenen verwalten Regie und Board.
        </p>
      </div>
    );
  }

  const production = await getActiveProduction(session.user?.id);
  if (!production) {
    return (
      <div className="space-y-6">
        <PageHeader title={current.title} breadcrumbs={breadcrumbs} />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle oben eine Produktion aus, um Rollen und Szenen zu verwalten."
        />
      </div>
    );
  }

  const data = await loadRolesAndScenes(production.id);
  const showTitle = production.title ?? `Produktion ${production.year}`;

  return (
    <div className="space-y-4">
      <PageHeader title={current.title} breadcrumbs={breadcrumbs} />

      <div className="flex items-center gap-2">
        <nav
          aria-label="Ansicht"
          className="flex flex-1 gap-0.5 rounded-lg bg-muted/70 p-0.5 sm:flex-none"
        >
          {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((key) => (
            <Link
              key={key}
              href={VIEWS[key].href}
              aria-current={key === view ? "page" : undefined}
              className={cn(
                "inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium sm:flex-none",
                key === view
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEWS[key].label} {key === "rollen" ? data.roles.length : data.scenes.length}
            </Link>
          ))}
        </nav>
        {view === "rollen" ? (
          <CastingExportDialog
            showTitle={showTitle}
            characters={data.roles.map((role) => ({
              id: role.id,
              name: role.name,
              shortName: role.shortName,
              description: role.description,
              notes: role.notes,
              color: role.color,
              castings: role.cast.map((entry) => ({
                id: entry.id,
                type: entry.type,
                notes: entry.notes,
                userName: entry.person.name,
              })),
            }))}
          />
        ) : null}
      </div>

      <Suspense>
        <RolesScenesClient data={data} view={view} />
      </Suspense>
    </div>
  );
}
