import { MemberMeasurementsControlCenter } from "@/components/members/measurements/member-measurements-control-center";
import { SizeTable } from "@/components/members/measurements/size-table";
import { PageHeader } from "@/components/members/page-header";
import { getActiveProductionId } from "@/lib/active-production";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { castOfShow, loadMeasurementMembers } from "@/lib/measurements/members";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import type { Prisma } from "@prisma/client";

export default async function MemberMeasurementsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.PROFILE.MEASUREMENTS.MANAGE");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-destructive">
          Kein Zugriff auf den Bereich für Körpermaße.
        </div>
      </div>
    );
  }

  const activeProductionId = await getActiveProductionId(session.user?.id);
  const memberFilters: Prisma.UserWhereInput[] = [
    { role: "cast" },
    { roles: { some: { role: "cast" } } },
    { measurements: { some: {} } },
  ];

  if (activeProductionId) {
    memberFilters.push(castOfShow(activeProductionId));
  }

  const normalizedMembers = await loadMeasurementMembers({ OR: memberFilters });

  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/koerpermasse")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Körpermaße"
        description="Körpermaße des Ensembles für das Kostüm-Team: vergleichen, ergänzen und exportieren."
        breadcrumbs={breadcrumbs}
      />
      <MemberMeasurementsControlCenter
        members={normalizedMembers}
        canConfigureMeasurements={allowed}
      />
      <SizeTable members={normalizedMembers} />
    </div>
  );
}
