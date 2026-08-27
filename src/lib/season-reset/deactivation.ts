import type { Prisma, Role } from "@prisma/client";

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
