import type {
  DepartmentMembershipRole,
  DepartmentPermissionMode,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type DepartmentMembershipContext = {
  departmentId: string;
  templateId: string | null;
  role: DepartmentMembershipRole;
};

export type TemplateGrant = { templateId: string; role: DepartmentMembershipRole; key: string };
export type DepartmentOverride = {
  departmentId: string;
  key: string;
  mode: DepartmentPermissionMode;
};

/**
 * Wirksame Rechte aus Gewerk-Mitgliedschaften (gewerke-plan.md, E6):
 * Blaupausen-Recht für die eigene Rolle + `grant` − `revoke` des Gewerks.
 * Abweichungen gelten für alle Mitglieder des Gewerks, unabhängig von der Rolle.
 */
export function resolveDepartmentPermissionKeys(
  memberships: ReadonlyArray<DepartmentMembershipContext>,
  templateGrants: ReadonlyArray<TemplateGrant>,
  overrides: ReadonlyArray<DepartmentOverride>,
): Set<string> {
  const keys = new Set<string>();
  for (const membership of memberships) {
    for (const key of resolveMembershipKeys(membership, templateGrants, overrides)) keys.add(key);
  }
  return keys;
}

/** Wirksame Rechte einer einzelnen Mitgliedschaft. */
export function resolveMembershipKeys(
  membership: DepartmentMembershipContext,
  templateGrants: ReadonlyArray<TemplateGrant>,
  overrides: ReadonlyArray<DepartmentOverride>,
): Set<string> {
  const keys = new Set<string>();
  if (membership.templateId) {
    for (const grant of templateGrants) {
      if (grant.templateId === membership.templateId && grant.role === membership.role) {
        keys.add(grant.key);
      }
    }
  }
  const own = overrides.filter((override) => override.departmentId === membership.departmentId);
  for (const override of own) if (override.mode === "grant") keys.add(override.key);
  for (const override of own) if (override.mode === "revoke") keys.delete(override.key);
  return keys;
}

/** Lädt Blaupausen-Rechte und Abweichungen für die angegebenen Mitgliedschaften. */
export async function loadDepartmentGrantSources(
  memberships: ReadonlyArray<DepartmentMembershipContext>,
  db: DbClient = prisma,
): Promise<{ templateGrants: TemplateGrant[]; overrides: DepartmentOverride[] }> {
  if (!memberships.length) return { templateGrants: [], overrides: [] };
  const templateIds = [
    ...new Set(memberships.flatMap((membership) => membership.templateId ?? [])),
  ];
  const departmentIds = [...new Set(memberships.map((membership) => membership.departmentId))];
  const [templateRows, overrideRows] = await Promise.all([
    templateIds.length
      ? db.templatePermission.findMany({
          where: { templateId: { in: templateIds } },
          select: { templateId: true, role: true, permission: { select: { key: true } } },
        })
      : [],
    db.departmentPermission.findMany({
      where: { departmentId: { in: departmentIds } },
      select: { departmentId: true, mode: true, permission: { select: { key: true } } },
    }),
  ]);
  return {
    templateGrants: templateRows.map((row) => ({
      templateId: row.templateId,
      role: row.role,
      key: row.permission.key,
    })),
    overrides: overrideRows.map((row) => ({
      departmentId: row.departmentId,
      mode: row.mode,
      key: row.permission.key,
    })),
  };
}

export async function loadDepartmentPermissionKeys(
  memberships: ReadonlyArray<DepartmentMembershipContext>,
  db: DbClient = prisma,
): Promise<Set<string>> {
  const { templateGrants, overrides } = await loadDepartmentGrantSources(memberships, db);
  return resolveDepartmentPermissionKeys(memberships, templateGrants, overrides);
}

/**
 * Bedingung für Gewerk-Mitgliedschaften, die ein Recht wirksam geben – für Empfängerlisten.
 * `null`, wenn kein Gewerk das Recht gibt.
 */
export async function departmentMembershipWhereForPermission(
  permissionKey: string,
  db: DbClient = prisma,
): Promise<Prisma.DepartmentMembershipWhereInput | null> {
  const [templateRows, overrideRows] = await Promise.all([
    db.templatePermission.findMany({
      where: { permission: { key: permissionKey } },
      select: { templateId: true, role: true },
    }),
    db.departmentPermission.findMany({
      where: { permission: { key: permissionKey } },
      select: { departmentId: true, mode: true },
    }),
  ]);
  const granted = overrideRows.filter((row) => row.mode === "grant").map((row) => row.departmentId);
  const revoked = overrideRows
    .filter((row) => row.mode === "revoke")
    .map((row) => row.departmentId);
  const or: Prisma.DepartmentMembershipWhereInput[] = [
    ...(granted.length ? [{ departmentId: { in: granted } }] : []),
    ...templateRows.map((row) => ({
      role: row.role,
      department: { templateId: row.templateId },
      ...(revoked.length ? { departmentId: { notIn: revoked } } : {}),
    })),
  ];
  return or.length ? { OR: or } : null;
}
