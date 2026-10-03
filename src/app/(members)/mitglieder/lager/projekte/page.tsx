import Link from "next/link";

import { LagerNav } from "@/components/inventory/lager-nav";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { CalendarIcon, PlusIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import {
  formatDateRange,
  INVENTORY_PROJECTS_PATH,
  inventoryProjectPath,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONES,
} from "@/lib/inventory/project-constants";
import { listInventoryProjects } from "@/lib/inventory/projects";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const params = await searchParams;
  const past = params.zeit === "vergangen";
  const projects = await listInventoryProjects({ scope: past ? "past" : "current" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projekte"
        description="Veranstaltungen, Verleih und eigene Produktionen – mit Terminen und Material."
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "projekte", label: "Projekte" },
        ]}
        actions={
          <Button asChild size="sm">
            <Link href={`${INVENTORY_PROJECTS_PATH}/neu`}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Projekt anlegen
            </Link>
          </Button>
        }
      />
      <LagerNav active="projekte" canManage={access.canManage} />

      <div className="flex gap-2 text-sm" role="tablist" aria-label="Zeitraum">
        {[
          {
            id: "aktuell",
            label: "Anstehend & laufend",
            href: INVENTORY_PROJECTS_PATH,
            active: !past,
          },
          {
            id: "vergangen",
            label: "Vergangen",
            href: `${INVENTORY_PROJECTS_PATH}?zeit=vergangen`,
            active: past,
          },
        ].map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={tab.active}
            className={cn(
              "rounded-full border px-3 py-1.5 font-medium transition-colors",
              tab.active
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {projects.length ? (
        <ListRowGroup variant="inset" className="bg-card">
          {projects.map((project) => (
            <ListRow
              key={project.id}
              href={inventoryProjectPath(project.publicId)}
              leading={
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <CalendarIcon className="h-5 w-5" />
                </span>
              }
              title={project.title}
              description={[
                formatDateRange(project.startsOn, project.endsOn),
                project.venue,
                project.contactName,
                project.pieces ? `${project.pieces} Teile` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              trailing={
                <ToneBadge tone={PROJECT_STATUS_TONES[project.status]}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </ToneBadge>
              }
            />
          ))}
        </ListRowGroup>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {past ? "Noch keine vergangenen Projekte." : "Keine anstehenden Projekte."}
        </div>
      )}
    </div>
  );
}
