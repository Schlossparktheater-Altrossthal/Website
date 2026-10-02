import type { Prisma } from "@prisma/client";

import type { MeasurementType, MeasurementUnit } from "@/data/measurements";
import { prisma } from "@/lib/prisma";
import { sortRoles, type Role } from "@/lib/roles";

/** Personen samt Maßen für die Körpermaße-Tabelle. */
export async function loadMeasurementMembers(where: Prisma.UserWhereInput) {
  const members = await prisma.user.findMany({
    where: { AND: [{ deactivatedAt: null }, where] },
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
        select: { id: true, type: true, value: true, unit: true, note: true, updatedAt: true },
      },
    },
  });

  return members.map((member) => ({
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
}

/** Alle, die in einer Rolle der Produktion besetzt sind. */
export function castOfShow(showId: string): Prisma.UserWhereInput {
  return { characterCastings: { some: { character: { showId } } } };
}
