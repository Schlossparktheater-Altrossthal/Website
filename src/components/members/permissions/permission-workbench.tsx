import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PERMISSION_DEFINITIONS,
  PERMISSION_CATEGORY_LABELS,
  ensurePermissionDefinitions,
  ensureSystemRoles,
} from "@/lib/permissions";
import { PermissionWorkbenchClient } from "@/components/members/permissions/permission-workbench-client";

export async function PermissionWorkbench() {
  await Promise.all([ensureSystemRoles(), ensurePermissionDefinitions()]);

  const [roles, permissions, roleGrants, departments, departmentGrants] = await Promise.all([
    prisma.appRole.findMany({
      orderBy: [{ isSystem: "desc" }, { sortIndex: "asc" }, { name: "asc" }],
      select: { id: true, name: true, isSystem: true, systemRole: true, sortIndex: true },
    }),
    prisma.permission.findMany({
      where: { key: { in: DEFAULT_PERMISSION_DEFINITIONS.map((definition) => definition.key) } },
      select: { id: true, key: true, label: true, description: true },
    }),
    prisma.appRolePermission.findMany({
      select: { roleId: true, permission: { select: { key: true } } },
    }),
    prisma.department.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, slug: true, requiresJoinApproval: true },
    }),
    prisma.departmentPermission.findMany({
      select: { departmentId: true, permission: { select: { key: true } } },
    }),
  ]);

  const permissionMap = new Map(permissions.map((permission) => [permission.key, permission]));

  const orderedPermissions = DEFAULT_PERMISSION_DEFINITIONS.map((definition) => {
    const match = permissionMap.get(definition.key);
    const categoryKey = definition.category;
    return {
      id: match?.id ?? definition.key,
      key: definition.key,
      label: match?.label ?? definition.label,
      description: match?.description ?? definition.description ?? null,
      categoryKey,
      categoryLabel: PERMISSION_CATEGORY_LABELS[categoryKey] ?? categoryKey,
    };
  });

  const roleGrantMap: Record<string, string[]> = {};
  for (const grant of roleGrants) {
    if (!roleGrantMap[grant.roleId]) {
      roleGrantMap[grant.roleId] = [];
    }
    roleGrantMap[grant.roleId]!.push(grant.permission.key);
  }

  const departmentGrantMap: Record<string, string[]> = {};
  for (const grant of departmentGrants) {
    if (!departmentGrantMap[grant.departmentId]) {
      departmentGrantMap[grant.departmentId] = [];
    }
    departmentGrantMap[grant.departmentId]!.push(grant.permission.key);
  }

  const systemRoles = roles
    .filter((role) => role.isSystem)
    .sort((a, b) => a.sortIndex - b.sortIndex);
  const customRoles = roles
    .filter((role) => !role.isSystem)
    .sort((a, b) => {
      if (a.sortIndex === b.sortIndex) {
        return a.name.localeCompare(b.name, "de");
      }
      return a.sortIndex - b.sortIndex;
    });

  return (
    <PermissionWorkbenchClient
      permissions={orderedPermissions}
      roles={customRoles}
      systemRoles={systemRoles}
      departments={departments}
      roleGrants={roleGrantMap}
      departmentGrants={departmentGrantMap}
    />
  );
}

export default PermissionWorkbench;
