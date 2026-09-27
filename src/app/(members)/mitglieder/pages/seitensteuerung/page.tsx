import { redirect } from "next/navigation";
import { PageHeader } from "@/components/members/page-header";
import { TextLink } from "@/components/ui/text-link";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { DEFAULT_PERMISSION_DEFINITIONS, hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { SeitensteuerungManager } from "./seitensteuerung-manager";

export default async function SeitensteuerungPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.PAGES.MANAGE");
  if (!allowed) redirect("/mitglieder");

  const permissionLabels = Object.fromEntries(
    DEFAULT_PERMISSION_DEFINITIONS.map((definition) => [definition.key, definition.label]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seitensteuerung"
        description={
          <>
            Ausgeblendete Seiten verschwinden aus dem Menü und sind für Mitglieder gesperrt. Wer
            Pages verwalten darf, erreicht sie weiterhin. Änderungen gelten sofort. Wer eine
            sichtbare Seite nutzen darf, regelst du unter{" "}
            <TextLink href="/mitglieder/rechte">Rollen &amp; Rechte</TextLink>.
          </>
        }
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/pages/seitensteuerung")]}
      />
      <SeitensteuerungManager permissionLabels={permissionLabels} />
    </div>
  );
}
