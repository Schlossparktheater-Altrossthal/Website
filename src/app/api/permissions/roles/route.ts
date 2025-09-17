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
  const roles = await prisma.appRole.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ roles });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "manage_permissions"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { name?: string } | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const created = await prisma.appRole.create({ data: { name: body.name.trim(), isSystem: false } });
  return NextResponse.json({ ok: true, role: created });
}

