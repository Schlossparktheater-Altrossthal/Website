import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles, hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export async function GET() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "manage_permissions"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureSystemRoles();

  const [roles, permissions, grants] = await Promise.all([
    prisma.appRole.findMany({ orderBy: { name: "asc" } }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
    prisma.appRolePermission.findMany({ select: { roleId: true, permission: { select: { key: true } } } }),
  ]);

  const grantsMap: Record<string, string[]> = {};
  for (const g of grants) {
    if (!grantsMap[g.roleId]) grantsMap[g.roleId] = [];
    grantsMap[g.roleId].push(g.permission.key);
  }

  return NextResponse.json({ roles, permissions, grants: grantsMap });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "manage_permissions"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as
    | { roleId: string; permissionKey: string; grant: boolean }
    | null;
  if (!body || typeof body.roleId !== "string" || typeof body.permissionKey !== "string") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const role = await prisma.appRole.findUnique({ where: { id: body.roleId } });
  if (!role) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 });

  // Do not edit owner/admin via matrix; they are wildcard
  if (role.systemRole === "owner" || role.systemRole === "admin") {
    return NextResponse.json({ error: "Owner/Admin sind nicht editierbar" }, { status: 400 });
  }

  const perm = await prisma.permission.upsert({
    where: { key: body.permissionKey },
    update: {},
    create: { key: body.permissionKey },
  });

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

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "manage_permissions"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { key?: string; label?: string; description?: string } | null;
  if (!body || typeof body.key !== "string" || !body.key.trim()) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const created = await prisma.permission.create({ data: { key: body.key.trim(), label: body.label ?? null, description: body.description ?? null } });
  return NextResponse.json({ ok: true, permission: created });
}

