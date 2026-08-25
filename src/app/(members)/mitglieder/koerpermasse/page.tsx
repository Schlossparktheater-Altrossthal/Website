import { MemberMeasurementsControlCenter } from "@/components/members/measurements/member-measurements-control-center";
import { PageHeader } from "@/components/members/page-header";
import { getActiveProductionId } from "@/lib/active-production";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { sortRoles, type Role } from "@/lib/roles";
import type { MeasurementType, MeasurementUnit } from "@/data/measurements";
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
    memberFilters.push({
      characterCastings: {
        some: { character: { showId: activeProductionId } },
      },
    });
  }

  const members = await prisma.user.findMany({
    where: {
      OR: memberFilters,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      role: true,
      roles: { select: { role: true } },
      avatarSource: true,
      avatarImageUpdatedAt: true,
      measurements: {
        orderBy: { type: "asc" },
        select: {
          id: true,
          type: true,
          value: true,
          unit: true,
          note: true,
          updatedAt: true,
        },
      },
    },
  });

  const normalizedMembers = members.map((member) => ({
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    name: member.name,
    roles: sortRoles([member.role as Role, ...member.roles.map((entry) => entry.role as Role)]),
    avatarSource: member.avatarSource,
    avatarUpdatedAt: member.avatarImageUpdatedAt?.toISOString() ?? null,
    measurements: member.measurements.map((measurement) => ({
      id: measurement.id,
      type: measurement.type as MeasurementType,
      value: measurement.value,
      unit: measurement.unit as MeasurementUnit,
      note: measurement.note,
      updatedAt: measurement.updatedAt.toISOString(),
    })),
  }));

  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/koerpermasse")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Körpermaße"
        description="Futuristisches Control Center für das Kostüm-Team: Synchronisiere, vergleiche und aktualisiere die Körpermaße des gesamten Ensembles in einem Blick."
        breadcrumbs={breadcrumbs}
      />
      <MemberMeasurementsControlCenter
        members={normalizedMembers}
        canConfigureMeasurements={allowed}
      />
    </div>
  );
}
