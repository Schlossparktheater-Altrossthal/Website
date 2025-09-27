import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

export default async function ProfilePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.profil");

  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf den Profilbereich</div>;
  }

  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p className="font-semibold text-foreground">Profilbereich deaktiviert</p>
      <p>
        Der bisherige Profilbereich wurde entfernt und steht dir aktuell nicht zur Verfügung. Wir melden uns,
        sobald eine neue Profilverwaltung verfügbar ist.
      </p>
    </div>
  );
}
