import { NextRequest, NextResponse } from "next/server";
import { requireAuth, ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sortRoles, type Role } from "@/lib/roles";

export async function PUT(request: NextRequest) {
  await requireAuth(["admin"]);
  const body = await request.json().catch(() => null);

  if (!body || typeof body.userId !== "string" || !Array.isArray(body.roles)) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const provided = Array.from(new Set(body.roles)).filter(
    (role): role is Role => typeof role === "string" && (ROLES as readonly string[]).includes(role),
  );

  if (provided.length === 0) {
    return NextResponse.json({ error: "Mindestens eine Rolle erforderlich" }, { status: 400 });
  }

  const orderedRoles = sortRoles(provided);
  const primaryRole = orderedRoles[0];

  try {
    const updated = await prisma.user.update({
      where: { id: body.userId },
      data: {
        role: primaryRole,
        roles: {
          deleteMany: {},
          create: orderedRoles.map((role) => ({ role })),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: { select: { role: true } },
      },
    });

    const allRoles = sortRoles([updated.role, ...updated.roles.map((r) => r.role as Role)]);

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        roles: allRoles,
      },
      roles: allRoles,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}
