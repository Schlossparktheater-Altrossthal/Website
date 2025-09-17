import { NextRequest, NextResponse } from "next/server";
import { requireAuth, ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sortRoles, type Role } from "@/lib/roles";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "manage_roles"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rawBody: unknown = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { userId, roles, customRoleIds } = rawBody as { userId?: unknown; roles?: unknown; customRoleIds?: unknown };

  if (typeof userId !== "string" || !Array.isArray(roles)) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const customIds = Array.isArray(customRoleIds)
    ? Array.from(new Set(customRoleIds)).filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];

  const provided = Array.from(new Set(roles)).filter(
    (role): role is Role => typeof role === "string" && (ROLES as readonly string[]).includes(role),
  );

  if (provided.length === 0) {
    return NextResponse.json({ error: "Mindestens eine Rolle erforderlich" }, { status: 400 });
  }

  const orderedRoles = sortRoles(provided);

  // Guard: Admins cannot assign or remove the owner role
  const actorRoles = new Set(session.user?.roles ?? (session.user?.role ? [session.user.role] : []));
  const actorIsOwner = actorRoles.has("owner");
  const actorIsAdmin = actorRoles.has("admin");
  const assignsOwner = orderedRoles.includes("owner");
  if (assignsOwner && !actorIsOwner) {
    return NextResponse.json({ error: "Nur Owner dürfen Owner zuweisen" }, { status: 403 });
  }

  // We need target user's current roles to detect owner removal
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      roles: { select: { role: true } },
    },
  });
  if (!target) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }
  const beforeRoles = sortRoles([target.role as Role, ...target.roles.map((r) => r.role as Role)]);
  const hadOwnerBefore = beforeRoles.includes("owner");
  const willHaveOwnerAfter = orderedRoles.includes("owner");
  if (hadOwnerBefore && !willHaveOwnerAfter) {
    // Prevent removing last owner
    const ownersCount = await prisma.userRole.count({ where: { role: "owner" } });
    const isLastOwner = ownersCount <= 1; // only this user has owner
    if (isLastOwner) {
      return NextResponse.json({ error: "Es muss immer mindestens einen Owner geben" }, { status: 400 });
    }
    if (!actorIsOwner) {
      return NextResponse.json({ error: "Nur Owner dürfen Owner entfernen" }, { status: 403 });
    }
  }

  // Keep legacy primary role field for compatibility (highest role)
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
        appRoles: {
          deleteMany: {},
          create: customIds.map((rid) => ({ roleId: rid })),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: { select: { role: true } },
        appRoles: { select: { role: { select: { id: true, name: true } } } },
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
        customRoles: updated.appRoles.map((ar) => ar.role),
      },
      roles: allRoles,
      customRoles: updated.appRoles.map((ar) => ar.role),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen";
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Benutzer wurde nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
