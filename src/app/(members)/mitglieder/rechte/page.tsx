import { PageHeader } from "@/components/members/page-header";
import { requireAuth } from "@/lib/rbac";
import { ensurePermissionDefinitions, ensureSystemRoles, hasPermission } from "@/lib/permissions";
import { PermissionWorkbench } from "@/components/members/permissions/permission-workbench";

export default async function RechteVerwaltungPage() {
  const session = await requireAuth();
  await Promise.all([ensureSystemRoles(), ensurePermissionDefinitions()]);
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.PERMISSIONS.MANAGE");
  if (!allowed) {
    // Next.js server components cannot return 403 easily; show message
    return <div className="text-sm text-destructive">Kein Zugriff auf die Rechteverwaltung</div>;
  }
  return (
    <>
      <PageHeader
        title="Rollen & Rechte"
        description="Haken setzen erlaubt der Rolle das Recht. Änderungen gelten sofort. Rollen vergibst du in der Mitgliederverwaltung."
      />
      <PermissionWorkbench />
    </>
  );
}
