import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { isMandatoryRole } from "@/lib/roles";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PERMISSIONS.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (!body || typeof body.name !== "string") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const name = body.name.trim();
  if (!name) return NextResponse.json({ error: "Name darf nicht leer sein" }, { status: 400 });

  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 });
  if (role.isSystem || role.systemRole)
    return NextResponse.json(
      { error: "Eingebaute Rollen können nicht umbenannt werden" },
      { status: 400 },
    );

  try {
    const updated = await prisma.appRole.update({ where: { id }, data: { name } });
    return NextResponse.json({ ok: true, role: updated });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Der Rollenname ist bereits vergeben" }, { status: 409 });
    }
    console.error("Rolle konnte nicht umbenannt werden", err);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PERMISSIONS.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 });
  // Mitglied, Admin und Owner sind Pflichtrollen; alle anderen – auch die eingebauten
  // Vorstand, Ensemble, Technik und Finanzen – dürfen gelöscht werden.
  if (role.isSystem || isMandatoryRole(role.systemRole))
    return NextResponse.json(
      { error: "Mitglied, Admin und Owner können nicht gelöscht werden" },
      { status: 400 },
    );

  try {
    await prisma.appRole.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Rolle konnte nicht gelöscht werden", error);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
