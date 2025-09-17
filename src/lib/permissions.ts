import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { Prisma } from "@prisma/client";

export async function hasPermission(
  user: { id?: string; role?: Role; roles?: Role[] } | null | undefined,
  permissionKey: string,
): Promise<boolean> {
  if (!user?.id) return false;
  const owned = new Set<Role>();
  if (user.role) owned.add(user.role);
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) owned.add(r);
  }
  if (owned.has("owner") || owned.has("admin")) return true;

  // Map system roles to AppRole ids
  const systemRoles = Array.from(owned);

  const [perm, customAssignments] = await Promise.all([
    prisma.permission.findUnique({ where: { key: permissionKey } }),
    prisma.userAppRole.findMany({
      where: { userId: user.id },
      select: { roleId: true },
    }),
  ]);

  if (!perm) return false;

  const customRoleIds = customAssignments.map((assignment) => assignment.roleId);

  if (!systemRoles.length && !customRoleIds.length) return false;

  const roleFilters: Prisma.AppRolePermissionWhereInput[] = [];
  if (systemRoles.length) {
    roleFilters.push({ role: { systemRole: { in: systemRoles } } });
  }
  if (customRoleIds.length) {
    roleFilters.push({ roleId: { in: customRoleIds } });
  }

  if (!roleFilters.length) return false;

  const rolePermissions = await prisma.appRolePermission.count({
    where: {
      permissionId: perm.id,
      OR: roleFilters,
    },
  });

  return rolePermissions > 0;
}

export async function ensureSystemRoles() {
  // Create AppRole entries for all enum roles if missing
  const systemRoles: Role[] = [
    "member",
    "cast",
    "tech",
    "board",
    "finance_admin",
    "owner",
    "admin",
  ];
  for (const r of systemRoles) {
    await prisma.appRole.upsert({
      where: { name: r },
      update: { systemRole: r, isSystem: true },
      create: { name: r, systemRole: r, isSystem: true },
    });
  }
}

