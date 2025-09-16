import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  await requireAuth(["admin"]);
  const id = params.id;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof (body as any).email === "string") {
    const email = (body as any).email.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "E-Mail darf nicht leer sein" }, { status: 400 });
    }
    updates.email = email;
  }

  if (typeof (body as any).name === "string" || (body as any).name === null) {
    const name = (body as any).name;
    updates.name = typeof name === "string" ? name.trim() || null : null;
  }

  if (typeof (body as any).password === "string" && (body as any).password.length > 0) {
    const password = (body as any).password as string;
    if (password.length < 6) {
      return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen haben" }, { status: 400 });
    }
    updates.passwordHash = await hashPassword(password);
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
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "E-Mail wird bereits verwendet" }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message ?? "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}
