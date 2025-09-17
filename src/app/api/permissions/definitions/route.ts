import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PERMISSION_DEFINITIONS,
  ensurePermissionDefinitions,
  ensureSystemRoles,
  hasPermission,
  isKnownPermissionKey,
} from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export async function GET() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rechte"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await Promise.all([ensureSystemRoles(), ensurePermissionDefinitions()]);

  const [roles, permissions, grants] = await Promise.all([
    prisma.appRole.findMany({ where: { isSystem: false }, orderBy: { name: "asc" } }),
    prisma.permission.findMany({ where: { key: { in: DEFAULT_PERMISSION_DEFINITIONS.map((def) => def.key) } } }),
    prisma.appRolePermission.findMany({ select: { roleId: true, permission: { select: { key: true } } } }),
  ]);

  const grantsMap: Record<string, string[]> = {};
  for (const g of grants) {
    if (!grantsMap[g.roleId]) grantsMap[g.roleId] = [];
    grantsMap[g.roleId].push(g.permission.key);
  }

  const permissionMap = new Map(permissions.map((perm) => [perm.key, perm]));
  const orderedPermissions = DEFAULT_PERMISSION_DEFINITIONS.map((definition) => {
    const match = permissionMap.get(definition.key);
    return {
      id: match?.id ?? definition.key,
      key: definition.key,
      label: match?.label ?? definition.label,
      description: match?.description ?? definition.description ?? null,
    };
  });

  return NextResponse.json({ roles, permissions: orderedPermissions, grants: grantsMap });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rechte"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as
    | { roleId: string; permissionKey: string; grant: boolean }
    | null;
  if (!body || typeof body.roleId !== "string" || typeof body.permissionKey !== "string") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  if (!isKnownPermissionKey(body.permissionKey)) {
    return NextResponse.json({ error: "Unbekanntes Recht" }, { status: 400 });
  }

  await ensurePermissionDefinitions();

  const role = await prisma.appRole.findUnique({ where: { id: body.roleId } });
  if (!role) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 });

  // Do not edit owner/admin via matrix; they are wildcard
  if (role.isSystem) {
    return NextResponse.json({ error: "Owner/Admin sind nicht editierbar" }, { status: 400 });
  }

  const perm = await prisma.permission.findUnique({ where: { key: body.permissionKey } });
  if (!perm) {
    return NextResponse.json({ error: "Recht nicht gefunden" }, { status: 404 });
  }

  if (body.grant) {
    await prisma.appRolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
  } else {
    await prisma.appRolePermission.deleteMany({ where: { roleId: role.id, permissionId: perm.id } });
  }

  return NextResponse.json({ ok: true });
}

