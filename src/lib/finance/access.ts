import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { FINANCE_PERMISSION_KEYS } from "@/lib/finance/constants";

type UserLike = { id?: string } | null | undefined;

export type FinanceAccess = {
  manage: boolean;
  /** Alles lesen (Vorstand, Kassenprüfung) – `manage` schließt es ein. */
  viewAll: boolean;
  /** Gewerke, deren Budget und Auslagen die Person als Leitung/Vertretung sieht. */
  leadDepartmentIds: string[];
};

/** Leitung oder Vertretung aktiver Gewerke. */
export async function getLeadDepartmentIds(userId: string): Promise<string[]> {
  const rows = await prisma.departmentMembership.findMany({
    where: {
      userId,
      status: "active",
      role: { in: ["lead", "deputy"] },
      department: { archivedAt: null },
    },
    select: { departmentId: true },
  });
  return rows.map((row) => row.departmentId);
}

export const getFinanceAccess = cache(async (user: UserLike): Promise<FinanceAccess> => {
  if (!user?.id) return { manage: false, viewAll: false, leadDepartmentIds: [] };
  const [manage, view, leadDepartmentIds] = await Promise.all([
    hasPermission(user, FINANCE_PERMISSION_KEYS.manage),
    hasPermission(user, FINANCE_PERMISSION_KEYS.view),
    getLeadDepartmentIds(user.id),
  ]);
  return { manage, viewAll: manage || view, leadDepartmentIds };
});

export function canSeeDepartmentFinance(access: FinanceAccess, departmentId: string): boolean {
  return access.viewAll || access.leadDepartmentIds.includes(departmentId);
}
