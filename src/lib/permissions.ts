import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

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
  if (!systemRoles.length) return false;

  // Ensure permission exists
  const perm = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!perm) return false;

  const rolePermissions = await prisma.appRolePermission.findMany({
    where: {
      role: { systemRole: { in: systemRoles } },
      permissionId: perm.id,
    },
    select: { id: true },
  });
  return rolePermissions.length > 0;
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

