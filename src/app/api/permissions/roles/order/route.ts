import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rechte"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { roleIds?: unknown } | null;
  if (!body || !Array.isArray(body.roleIds) || !body.roleIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const roleIds = body.roleIds;
  if (roleIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const uniqueIds = new Set(roleIds);
  if (uniqueIds.size !== roleIds.length) {
    return NextResponse.json({ error: "Rollen dürfen nur einmal vorkommen" }, { status: 400 });
  }

  const existing = await prisma.appRole.findMany({
    where: { id: { in: roleIds }, isSystem: false },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((role) => role.id));
  const missing = roleIds.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json({ error: "Unbekannte Rollen können nicht sortiert werden" }, { status: 400 });
  }

  await prisma.$transaction(
    roleIds.map((id, index) =>
      prisma.appRole.update({
        where: { id },
        data: { sortIndex: index },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
