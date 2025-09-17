import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

type UpdateMemberPayload = {
  email?: unknown;
  name?: unknown;
  password?: unknown;
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rollenverwaltung"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = params.id;
  const rawBody: unknown = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const body = rawBody as UpdateMemberPayload;
  const updates: Record<string, unknown> = {};

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "E-Mail darf nicht leer sein" }, { status: 400 });
    }
    updates.email = email;
  } else if (body.email !== undefined) {
    return NextResponse.json({ error: "E-Mail muss eine Zeichenkette sein" }, { status: 400 });
  }

  if (typeof body.name === "string") {
    updates.name = body.name.trim() || null;
  } else if (body.name === null) {
    updates.name = null;
  } else if (body.name !== undefined) {
    return NextResponse.json({ error: "Name hat ein ungültiges Format" }, { status: 400 });
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen haben" }, { status: 400 });
    }
    updates.passwordHash = await hashPassword(body.password);
  } else if (body.password !== undefined && typeof body.password !== "string") {
    return NextResponse.json({ error: "Passwort hat ein ungültiges Format" }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen übermittelt" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: updates,
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "E-Mail wird bereits verwendet" }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
