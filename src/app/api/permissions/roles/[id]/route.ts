import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rechte"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = params.id;
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (!body || typeof body.name !== "string") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const name = body.name.trim();
  if (!name) return NextResponse.json({ error: "Name darf nicht leer sein" }, { status: 400 });

  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ error: "Systemrollen können nicht bearbeitet werden" }, { status: 400 });

  try {
    const updated = await prisma.appRole.update({ where: { id }, data: { name } });
    return NextResponse.json({ ok: true, role: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Der Rollenname ist bereits vergeben" }, { status: 409 });
    }
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rechte"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = params.id;
  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ error: "Systemrollen können nicht gelöscht werden" }, { status: 400 });

  try {
    await prisma.appRole.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
