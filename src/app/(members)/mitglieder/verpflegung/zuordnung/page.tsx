import { PageHeader } from "@/components/members/page-header";
import { FoodDataAttribution } from "@/components/food/food-data-attribution";
import { listPendingRestrictions } from "@/lib/food/pending";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { FOOD_PERMISSION_KEYS, hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { PendingList } from "./pending-list";

export default async function FoodMappingPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, FOOD_PERMISSION_KEYS.taxonomyManage);
  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Kein Zugriff: Das Recht vergibt der Vorstand oder das Gewerk, das die Essensplanung macht.
        </div>
      </div>
    );
  }

  const groups = await listPendingRestrictions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allergie-Zuordnung"
        description="Freitext-Angaben, die das System nicht sicher erkannt hat. Einmal zugeordnet, wird der Text künftig automatisch erkannt."
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/verpflegung/zuordnung")]}
      />
      <PendingList groups={groups} />
      <FoodDataAttribution />
    </div>
  );
}
