import { NextRequest, NextResponse } from "next/server";
import { requireAuth, ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sortRoles, type Role } from "@/lib/roles";
import { hashPassword } from "@/lib/password";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { combineNameParts, splitFullName, trimToNull } from "@/lib/names";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rollenverwaltung"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rawBody: unknown = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const {
    email: emailValue,
    firstName: firstNameValue,
    lastName: lastNameValue,
    name: nameValue,
    password: passwordValue,
    roles: rolesValue,
  } = rawBody as {
    email?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    name?: unknown;
    password?: unknown;
    roles?: unknown;
  };

  if (typeof emailValue !== "string") {
    return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
  }

  const email = emailValue.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  let firstName: string | null = null;
  let lastName: string | null = null;
  let fallbackName: string | null = null;

  if (firstNameValue !== undefined) {
    if (typeof firstNameValue === "string") {
      firstName = trimToNull(firstNameValue);
    } else if (firstNameValue === null) {
      firstName = null;
    } else {
      return NextResponse.json({ error: "Ungültiger Vorname" }, { status: 400 });
    }
  }

  if (lastNameValue !== undefined) {
    if (typeof lastNameValue === "string") {
      lastName = trimToNull(lastNameValue);
    } else if (lastNameValue === null) {
      lastName = null;
    } else {
      return NextResponse.json({ error: "Ungültiger Nachname" }, { status: 400 });
    }
  }

  if (nameValue !== undefined) {
    if (typeof nameValue === "string") {
      fallbackName = trimToNull(nameValue);
    } else if (nameValue === null) {
      fallbackName = null;
    } else {
      return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 });
    }
  }

  if (nameValue !== undefined && firstNameValue === undefined && lastNameValue === undefined) {
    const split = splitFullName(fallbackName);
    firstName = split.firstName;
    lastName = split.lastName;
  }

  const displayName = combineNameParts(firstName, lastName) ?? fallbackName ?? null;

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

  // Only owners may assign the owner role
  const actorRoles = new Set(session.user?.roles ?? (session.user?.role ? [session.user.role] : []));
  if (roles.includes("owner") && !actorRoles.has("owner")) {
    return NextResponse.json({ error: "Nur Owner dürfen Owner zuweisen" }, { status: 403 });
  }

  // Keep legacy primary role field for compatibility (highest role)
  const primaryRole = roles[roles.length - 1];

  try {
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: displayName,
        role: primaryRole,
        passwordHash,
        roles: {
          create: roles.map((role) => ({ role })),
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        role: true,
        roles: { select: { role: true } },
      },
    });

    const allRoles = sortRoles([user.role, ...user.roles.map((r) => r.role as Role)]);
    const responseName = combineNameParts(user.firstName, user.lastName) ?? (user.name ?? null);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        name: responseName,
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
