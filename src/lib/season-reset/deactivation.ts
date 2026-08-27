import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

import { readSeasonResetSettings, resolveProtectedRoles } from "./settings";

export async function deactivateMembersForSeasonChange(
  tx: Prisma.TransactionClient,
  protectedRoles: readonly Role[],
): Promise<number> {
  const excluded = Array.from(new Set(protectedRoles));

  const result = await tx.user.updateMany({
    where: {
      deactivatedAt: null,
      role: { notIn: excluded },
      roles: { none: { role: { in: excluded } } },
    },
    data: {
      deactivatedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });

  return result.count;
}

export async function performSeasonChangeDeactivation(): Promise<number> {
  const record = await readSeasonResetSettings();
  const protectedRoles = resolveProtectedRoles(record);
  return prisma.$transaction((tx) => deactivateMembersForSeasonChange(tx, protectedRoles));
}
