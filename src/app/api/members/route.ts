import { NextRequest, NextResponse } from "next/server";
import { requireAuth, ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sortRoles, type Role } from "@/lib/roles";
import { hashPassword } from "@/lib/password";
import { Prisma } from "@prisma/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  await requireAuth(["admin"]);
  const rawBody: unknown = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { email: emailValue, name: nameValue, password: passwordValue, roles: rolesValue } = rawBody as {
    email?: unknown;
    name?: unknown;
    password?: unknown;
    roles?: unknown;
  };

  if (typeof emailValue !== "string") {
    return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
  }

  const email = emailValue.trim().toLowerCase();
  const name = typeof nameValue === "string" ? nameValue.trim() : undefined;
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  if (passwordValue !== undefined && typeof passwordValue !== "string") {
    return NextResponse.json({ error: "Passwort hat ein ungültiges Format" }, { status: 400 });
  }

  const password = typeof passwordValue === "string" ? passwordValue : "";
  if (password.length < 6) {
    return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen haben" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const requestedRoles = Array.isArray(rolesValue) ? rolesValue : [];
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
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Diese E-Mail existiert bereits" }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Anlegen fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
