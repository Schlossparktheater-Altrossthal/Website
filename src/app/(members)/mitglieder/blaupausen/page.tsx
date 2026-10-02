import { PageHeader } from "@/components/members/page-header";
import { loadTemplateAdminData } from "@/lib/departments/template-admin";
import { ensurePermissionDefinitions, hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { TemplateAdmin } from "./template-admin";

export default async function BlaupausenPage() {
  const session = await requireAuth();
  await ensurePermissionDefinitions();
  if (!(await hasPermission(session.user, "PRIVATE.DEPARTMENT.TEMPLATE.MANAGE"))) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Blaupausen.</div>;
  }
  const data = await loadTemplateAdminData();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Blaupausen"
        description="Vorlagen für Gewerke: Bausteine, Standardrechte und Onboarding. Änderungen wirken auf alle Gewerke der Blaupause."
      />
      <TemplateAdmin templates={data.templates} permissionGroups={data.permissionGroups} />
    </div>
  );
}
