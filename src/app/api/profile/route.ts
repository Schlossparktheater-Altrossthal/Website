import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sortRoles, type Role } from "@/lib/roles";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: { select: { role: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const roles = sortRoles([user.role as Role, ...user.roles.map((r) => r.role as Role)]);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    roles,
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if ("name" in body) {
    const name = body.name;
    if (typeof name === "string") {
      updates.name = name.trim() || null;
    } else if (name === null) {
      updates.name = null;
    } else {
      return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 });
    }
  }

  if ("email" in body) {
    const emailValue = body.email;
    if (typeof emailValue !== "string") {
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
    }
    const email = emailValue.trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
    }
    updates.email = email;
  }

  if ("password" in body) {
    const passwordValue = body.password;
    if (typeof passwordValue !== "string" || passwordValue.length < 6) {
      return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen haben" }, { status: 400 });
    }
    updates.passwordHash = await hashPassword(passwordValue);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen übermittelt" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roles: { select: { role: true } },
      },
    });

    const roles = sortRoles([updated.role as Role, ...updated.roles.map((r) => r.role as Role)]);

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        roles,
      },
    });
  } catch (error: unknown) {
    const code = extractErrorCode(error);
    if (code === "P2002") {
      return NextResponse.json({ error: "Diese E-Mail wird bereits verwendet" }, { status: 409 });
    }

    if (code === "P2025") {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      return code;
    }
  }
  return undefined;
}
