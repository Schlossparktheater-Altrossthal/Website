import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ProjectForm } from "@/components/inventory/project-form";
import { PageHeader } from "@/components/members/page-header";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { emptyProjectValues, INVENTORY_PROJECTS_PATH } from "@/lib/inventory/project-constants";
import { loadProjectFormOptions } from "@/lib/inventory/projects";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function NewProjectPage() {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const options = await loadProjectFormOptions();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Projekt anlegen"
        description="Eckdaten und Termine – das Material trägst du danach im Projekt ein."
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "projekte", label: "Projekte", href: INVENTORY_PROJECTS_PATH },
          { id: "neu", label: "Neu" },
        ]}
      />
      <div className="mx-auto max-w-3xl">
        <ProjectForm projectId={null} initialValues={emptyProjectValues()} {...options} />
      </div>
    </div>
  );
}
