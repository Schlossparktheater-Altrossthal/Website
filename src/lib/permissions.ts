import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { Prisma } from "@prisma/client";

type PermissionDefinition = { key: string; label: string; description?: string };

export const DEFAULT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: "mitglieder.dashboard", label: "Mitglieder-Dashboard öffnen" },
  { key: "mitglieder.profil", label: "Profilbereich aufrufen" },
  { key: "mitglieder.probenplanung", label: "Probenplanung verwalten" },
  { key: "mitglieder.rollenverwaltung", label: "Rollenverwaltung öffnen" },
  { key: "mitglieder.rechte", label: "Rechteverwaltung öffnen" },
  { key: "mitglieder.sperrliste", label: "Sperrliste pflegen" },
];

const DEFAULT_PERMISSION_KEYS = DEFAULT_PERMISSION_DEFINITIONS.map((def) => def.key);
const PERMISSION_KEY_SET = new Set(DEFAULT_PERMISSION_KEYS);

let ensurePermissionsPromise: Promise<void> | null = null;
let ensureSystemRolesPromise: Promise<void> | null = null;

async function runEnsurePermissionDefinitions() {
  const operations = DEFAULT_PERMISSION_DEFINITIONS.map((definition) =>
    prisma.permission.upsert({
      where: { key: definition.key },
      update: {
        label: definition.label,
        description: definition.description ?? null,
      },
      create: {
        key: definition.key,
        label: definition.label,
        description: definition.description ?? null,
      },
    }),
  );
  await prisma.$transaction(operations);
  await prisma.permission.deleteMany({ where: { key: { notIn: Array.from(PERMISSION_KEY_SET) } } });
}

export async function ensurePermissionDefinitions() {
  if (!ensurePermissionsPromise) {
    ensurePermissionsPromise = runEnsurePermissionDefinitions().catch((error) => {
      ensurePermissionsPromise = null;
      throw error;
    });
  }
  await ensurePermissionsPromise;
}

export function isKnownPermissionKey(key: string) {
  return PERMISSION_KEY_SET.has(key);
}

async function runEnsureSystemRoles() {
  const coreRoles: { role: Role; isSystem: boolean }[] = [
    { role: "member", isSystem: false },
    { role: "cast", isSystem: false },
    { role: "tech", isSystem: false },
    { role: "board", isSystem: false },
    { role: "finance_admin", isSystem: false },
    { role: "owner", isSystem: true },
    { role: "admin", isSystem: true },
  ];

  await prisma.$transaction(
    coreRoles.map(({ role, isSystem }) =>
      prisma.appRole.upsert({
        where: { name: role },
        update: { systemRole: role, isSystem },
        create: { name: role, systemRole: role, isSystem },
      }),
    ),
  );
}

export async function ensureSystemRoles() {
  if (!ensureSystemRolesPromise) {
    ensureSystemRolesPromise = runEnsureSystemRoles().catch((error) => {
      ensureSystemRolesPromise = null;
      throw error;
    });
  }
  await ensureSystemRolesPromise;
}

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

  if (!isKnownPermissionKey(permissionKey)) return false;

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

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
    roleFilters.push({
      role: {
        OR: [
          { systemRole: { in: systemRoles } },
          { name: { in: systemRoles } },
        ],
      },
    });
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

export async function getUserPermissionKeys(
  user: { id?: string; role?: Role; roles?: Role[] } | null | undefined,
): Promise<string[]> {
  if (!user?.id) return [];

  const owned = new Set<Role>();
  if (user.role) owned.add(user.role);
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) owned.add(r);
  }

  if (owned.has("owner") || owned.has("admin")) {
    return [...DEFAULT_PERMISSION_KEYS];
  }

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

  const systemRoles = Array.from(owned);

  const customAssignments = await prisma.userAppRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  });

  const customRoleIds = customAssignments.map((assignment) => assignment.roleId);

  const roleFilters: Prisma.AppRolePermissionWhereInput[] = [];
  if (systemRoles.length) {
    roleFilters.push({
      role: {
        OR: [
          { systemRole: { in: systemRoles } },
          { name: { in: systemRoles } },
        ],
      },
    });
  }
  if (customRoleIds.length) {
    roleFilters.push({ roleId: { in: customRoleIds } });
  }

  if (!roleFilters.length) return [];

  const rolePermissions = await prisma.appRolePermission.findMany({
    where: { OR: roleFilters },
    select: { permission: { select: { key: true } } },
  });

  const granted = new Set<string>();
  for (const entry of rolePermissions) {
    const key = entry.permission?.key;
    if (key && isKnownPermissionKey(key)) {
      granted.add(key);
    }
  }

  return DEFAULT_PERMISSION_KEYS.filter((key) => granted.has(key));
}
