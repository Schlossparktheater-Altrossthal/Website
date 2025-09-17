import { NextRequest, NextResponse } from "next/server";
import { requireAuth, ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sortRoles, type Role } from "@/lib/roles";
import { Prisma } from "@prisma/client";

export async function PUT(request: NextRequest) {
  await requireAuth(["admin"]);
  const rawBody: unknown = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { userId, roles } = rawBody as { userId?: unknown; roles?: unknown };

  if (typeof userId !== "string" || !Array.isArray(roles)) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const provided = Array.from(new Set(roles)).filter(
    (role): role is Role => typeof role === "string" && (ROLES as readonly string[]).includes(role),
  );

  if (provided.length === 0) {
    return NextResponse.json({ error: "Mindestens eine Rolle erforderlich" }, { status: 400 });
  }

  const orderedRoles = sortRoles(provided);
  const primaryRole = orderedRoles[orderedRoles.length - 1];

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen";
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Benutzer wurde nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
