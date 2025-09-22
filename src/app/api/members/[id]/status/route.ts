import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rollenverwaltung"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const rawBody: unknown = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { deactivated } = rawBody as { deactivated?: unknown };
  if (typeof deactivated !== "boolean") {
    return NextResponse.json({ error: "Status muss als boolescher Wert übermittelt werden" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      roles: { select: { role: true } },
      deactivatedAt: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  if (deactivated) {
    const alreadyDeactivated = target.deactivatedAt ?? null;
    const isOwner =
      target.role === "owner" || target.roles.some((entry) => entry.role === "owner");

    if (isOwner) {
      const remainingOwners = await prisma.user.count({
        where: {
          id: { not: target.id },
          deactivatedAt: null,
          OR: [{ role: "owner" }, { roles: { some: { role: "owner" } } }],
        },
      });

      if (remainingOwners === 0) {
        return NextResponse.json({ error: "Es muss immer mindestens einen Owner geben" }, { status: 400 });
      }
    }

    if (alreadyDeactivated) {
      return NextResponse.json({
        ok: true,
        user: { id: target.id, deactivatedAt: alreadyDeactivated.toISOString() },
      });
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: target.id },
        data: { deactivatedAt: deactivated ? new Date() : null },
        select: { id: true, deactivatedAt: true },
      });

      if (deactivated) {
        await tx.session.deleteMany({ where: { userId: target.id } });
      }

      return result;
    });

    return NextResponse.json({
      ok: true,
      user: { id: updated.id, deactivatedAt: updated.deactivatedAt?.toISOString() ?? null },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
