import { NextRequest, NextResponse } from "next/server";
import { requireAuth, ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sortRoles, type Role } from "@/lib/roles";
import { hashPassword } from "@/lib/password";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  await requireAuth(["admin"]);
  const body = await request.json().catch(() => null);

  if (!body || typeof body.email !== "string") {
    return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 6) {
    return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen haben" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const requestedRoles = Array.isArray(body.roles) ? body.roles : [];
  const filteredRoles = Array.from(new Set(requestedRoles)).filter(
    (role): role is Role => typeof role === "string" && (ROLES as readonly string[]).includes(role),
  );
  const roles = sortRoles(filteredRoles.length > 0 ? filteredRoles : ["member"]);
  const primaryRole = roles[0];

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        role: primaryRole,
        passwordHash,
        roles: {
          create: roles.map((role) => ({ role })),
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

    const allRoles = sortRoles([user.role, ...user.roles.map((r) => r.role as Role)]);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: allRoles,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Diese E-Mail existiert bereits" }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message ?? "Anlegen fehlgeschlagen" }, { status: 500 });
  }
}
