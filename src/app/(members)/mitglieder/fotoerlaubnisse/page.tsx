import { PhotoConsentAdminPanel } from "@/components/members/photo-consent-admin-panel";
import { ensurePermissionDefinitions, hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export default async function FotoErlaubnissePage() {
  const session = await requireAuth();
  await ensurePermissionDefinitions();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE");
  if (!allowed) {
    return (
      <div className="text-sm text-destructive">
        Kein Zugriff auf die Verwaltung der Fotoeinverständnisse
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PhotoConsentAdminPanel />
    </div>
  );
}
