import { requireAuth } from "@/lib/rbac";
import { ensurePermissionDefinitions, ensureSystemRoles, hasPermission } from "@/lib/permissions";
import { PermissionWorkbench } from "@/components/members/permissions/permission-workbench";

export default async function RechteVerwaltungPage() {
  const session = await requireAuth();
  await Promise.all([ensureSystemRoles(), ensurePermissionDefinitions()]);
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.PERMISSIONS.MANAGE");
  if (!allowed) {
    // Next.js server components cannot return 403 easily; show message
    return <div className="text-sm text-red-600">Kein Zugriff auf die Rechteverwaltung</div>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rechteverwaltung</h1>
        <p className="text-sm text-foreground/70">Lege Rollen an und weise ihnen Rechte zu. Owner/Admin haben automatisch Vollzugriff.</p>
      </div>
      <PermissionWorkbench />
    </div>
  );
}

