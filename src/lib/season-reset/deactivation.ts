import { prisma } from "@/lib/prisma";
import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import { currentMembershipWhere } from "@/lib/produktionen/status";
import type { Prisma, Role } from "@prisma/client";

import { readSeasonResetSettings, resolveProtectedRoles } from "./settings";

export type MemberDeactivationTx = {
  user: {
    updateMany(args: {
      where: Prisma.UserWhereInput;
      data: Prisma.UserUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
};

export type SeasonChangeCandidate = {
  id: string;
  name: string | null;
  email: string | null;
};

/**
 * Wer deaktiviert wird: aktive Nutzer ohne geschützte Rolle und ohne Mitgliedschaft in einer
 * geplanten oder aktiven Produktion (wer schon für die nächste Produktion ongeboardet ist, bleibt).
 */
export function buildSeasonChangeWhere(
  protectedRoles: readonly Role[],
  excludeUserIds: readonly string[] = [],
  now: Date = new Date(),
): Prisma.UserWhereInput {
  const excluded = Array.from(new Set(protectedRoles));
  const keepIds = Array.from(new Set(excludeUserIds));

  return {
    deactivatedAt: null,
    role: { notIn: excluded },
    roles: { none: { role: { in: excluded } } },
    productionMemberships: { none: currentMembershipWhere(now) },
    ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
  };
}

export async function deactivateMembersForSeasonChange(
  tx: MemberDeactivationTx,
  protectedRoles: readonly Role[],
  excludeUserIds: readonly string[] = [],
): Promise<number> {
  const result = await tx.user.updateMany({
    where: buildSeasonChangeWhere(protectedRoles, excludeUserIds),
    data: {
      deactivatedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });

  return result.count;
}

/** Listet, wen ein Saisonabschluss deaktivieren würde – ohne etwas zu ändern. */
export async function previewSeasonChangeDeactivation(): Promise<SeasonChangeCandidate[]> {
  const protectedRoles = resolveProtectedRoles(await readSeasonResetSettings());
  const users = await prisma.user.findMany({
    where: buildSeasonChangeWhere(protectedRoles),
    select: { id: true, name: true, firstName: true, lastName: true, email: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name,
    email: user.email,
  }));
}

export async function performSeasonChangeDeactivation(
  excludeUserIds: readonly string[] = [],
): Promise<number> {
  const record = await readSeasonResetSettings();
  const protectedRoles = resolveProtectedRoles(record);
  const count = await prisma.$transaction((tx) =>
    deactivateMembersForSeasonChange(tx, protectedRoles, excludeUserIds),
  );
  requestServiceGroupSync();
  return count;
}
