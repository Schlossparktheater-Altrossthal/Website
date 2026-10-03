import { notFound } from "next/navigation";

import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ProjectForm } from "@/components/inventory/project-form";
import { PageHeader } from "@/components/members/page-header";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import {
  dateOnlyValue,
  INVENTORY_PROJECTS_PATH,
  inventoryProjectPath,
} from "@/lib/inventory/project-constants";
import { getInventoryProjectDetail, loadProjectFormOptions } from "@/lib/inventory/projects";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { publicId } = await params;
  const [project, options] = await Promise.all([
    getInventoryProjectDetail(decodeURIComponent(publicId)),
    loadProjectFormOptions(),
  ]);
  if (!project) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${project.title} bearbeiten`}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "projekte", label: "Projekte", href: INVENTORY_PROJECTS_PATH },
          { id: "projekt", label: project.title, href: inventoryProjectPath(project.publicId) },
          { id: "edit", label: "Bearbeiten" },
        ]}
      />
      <div className="mx-auto max-w-3xl">
        <ProjectForm
          projectId={project.id}
          canDelete={access.canManage}
          {...options}
          initialValues={{
            title: project.title,
            status: project.status,
            contactName: project.contact?.name ?? "",
            venue: project.venue ?? "",
            leadUserId: project.leadUserId,
            leadName: project.leadName ?? "",
            showId: project.showId,
            note: project.note ?? "",
            phases: project.phases.map((phase) => ({
              kind: phase.kind,
              label: phase.label ?? "",
              startsOn: dateOnlyValue(phase.startsOn),
              endsOn: dateOnlyValue(phase.endsOn),
            })),
          }}
        />
      </div>
    </div>
  );
}
