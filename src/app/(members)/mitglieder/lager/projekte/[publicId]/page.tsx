import Link from "next/link";
import { notFound } from "next/navigation";

import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ProjectCheckoutButton } from "@/components/inventory/project-checkout-button";
import { ProjectLines } from "@/components/inventory/project-lines";
import { ProjectStatusSelect } from "@/components/inventory/project-status-select";
import { PageHeader } from "@/components/members/page-header";
import { EditIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import {
  formatDateRange,
  INVENTORY_PROJECTS_PATH,
  inventoryProjectPath,
  PHASE_KIND_LABELS,
} from "@/lib/inventory/project-constants";
import { getInventoryProjectDetail } from "@/lib/inventory/projects";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

const CARD = "space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { publicId } = await params;
  const project = await getInventoryProjectDetail(decodeURIComponent(publicId));
  if (!project) notFound();

  const facts = [
    { label: "Kunde", value: project.contact?.name },
    { label: "Veranstaltungsort", value: project.venue },
    { label: "Projektleitung", value: project.leadLabel },
    { label: "Produktion", value: project.showLabel },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.title}
        description={formatDateRange(project.startsOn, project.endsOn)}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "projekte", label: "Projekte", href: INVENTORY_PROJECTS_PATH },
          { id: "projekt", label: project.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusSelect id={project.id} status={project.status} />
            <Button asChild variant="outline" size="sm">
              <Link href={`${inventoryProjectPath(project.publicId)}/bearbeiten`}>
                <EditIcon className="mr-2 h-4 w-4" />
                Bearbeiten
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProjectLines
            projectId={project.id}
            hasWindow={Boolean(project.startsOn)}
            lines={project.lines}
          />
        </div>
        <div className="space-y-6">
          <section className={CARD}>
            <SectionHeader title="Eckdaten" />
            {facts.length ? (
              <dl className="space-y-2 text-sm">
                {facts.map((entry) => (
                  <div key={entry.label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{entry.label}</dt>
                    <dd className="text-right text-foreground">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Angaben.</p>
            )}
            {project.contact?.contactPerson || project.contact?.email || project.contact?.phone ? (
              <p className="text-xs text-muted-foreground">
                {[project.contact.contactPerson, project.contact.email, project.contact.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </section>
          <section className={CARD}>
            <SectionHeader title="Termine" />
            {project.phases.length ? (
              <ol className="space-y-2">
                {project.phases.map((phase) => (
                  <li key={phase.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">
                      {phase.label || PHASE_KIND_LABELS[phase.kind]}
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {formatDateRange(phase.startsOn, phase.endsOn)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Termine.</p>
            )}
          </section>
          <section className={CARD}>
            <SectionHeader
              title="Ausgaben"
              description="Packen und Rückgabe per Scan – gegen den Bedarf oben."
            />
            {project.checkouts.length ? (
              <ul className="space-y-1.5 text-sm">
                {project.checkouts.map((checkout) => (
                  <li key={checkout.id} className="flex justify-between gap-3">
                    <Link
                      href={`${INVENTORY_BASE_PATH}/ausgaben/${checkout.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {checkout.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {checkout.status === "open" ? "offen" : "abgeschlossen"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {project.lines.length ? (
              <ProjectCheckoutButton
                projectId={project.id}
                title={project.title}
                showId={project.showId}
                dueAt={project.endsOn ? project.endsOn.toISOString() : null}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Erst Material einplanen.</p>
            )}
          </section>
          {project.note ? (
            <section className={CARD}>
              <SectionHeader title="Notiz" />
              <p className="text-sm whitespace-pre-line text-foreground">{project.note}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
