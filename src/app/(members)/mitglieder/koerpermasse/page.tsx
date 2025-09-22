import { notFound } from "next/navigation";

import { MemberMeasurementsManager } from "@/components/members/measurements/member-measurements-manager";
import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import type { MeasurementType, MeasurementUnit } from "@/data/measurements";

export default async function MemberMeasurementsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.koerpermasse");

  if (!allowed) {
    return (
      <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-red-600">
        Kein Zugriff auf den Bereich für Körpermaße.
      </div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const measurements = await prisma.memberMeasurement.findMany({
    where: { userId },
    orderBy: { type: "asc" },
  });

  const initialMeasurements = measurements.map((measurement) => ({
    id: measurement.id,
    type: measurement.type as MeasurementType,
    value: measurement.value,
    unit: measurement.unit as MeasurementUnit,
    note: measurement.note,
    updatedAt: measurement.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Körpermaße"
        description="Pflege deine Maße direkt in deinem Profil – das Kostüm-Team sieht sie in der Gewerke-Übersicht und behält alle Schauspieler:innen im Blick."
      />
      <MemberMeasurementsManager initialMeasurements={initialMeasurements} />
    </div>
  );
}
