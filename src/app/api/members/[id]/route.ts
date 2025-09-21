import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { hasPermission } from "@/lib/permissions";
import { combineNameParts, splitFullName, trimToNull } from "@/lib/names";

type UpdateMemberPayload = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  name?: unknown;
  password?: unknown;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rollenverwaltung"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const rawBody: unknown = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const body = rawBody as UpdateMemberPayload;
  const updates: Record<string, unknown> = {};

  let firstNameProvided = false;
  let lastNameProvided = false;
  let parsedFirstName: string | null = null;
  let parsedLastName: string | null = null;
  let fallbackNameProvided = false;
  let fallbackFullName: string | null = null;

  if (typeof body.firstName === "string") {
    firstNameProvided = true;
    parsedFirstName = trimToNull(body.firstName);
  } else if (body.firstName === null) {
    firstNameProvided = true;
    parsedFirstName = null;
  } else if (body.firstName !== undefined) {
    return NextResponse.json({ error: "Vorname hat ein ungültiges Format" }, { status: 400 });
  }

  if (typeof body.lastName === "string") {
    lastNameProvided = true;
    parsedLastName = trimToNull(body.lastName);
  } else if (body.lastName === null) {
    lastNameProvided = true;
    parsedLastName = null;
  } else if (body.lastName !== undefined) {
    return NextResponse.json({ error: "Nachname hat ein ungültiges Format" }, { status: 400 });
  }

  if (typeof body.name === "string") {
    fallbackNameProvided = true;
    fallbackFullName = trimToNull(body.name);
  } else if (body.name === null) {
    fallbackNameProvided = true;
    fallbackFullName = null;
  } else if (body.name !== undefined) {
    return NextResponse.json({ error: "Name hat ein ungültiges Format" }, { status: 400 });
  }

  if (fallbackNameProvided && !firstNameProvided && !lastNameProvided) {
    const split = splitFullName(fallbackFullName);
    firstNameProvided = true;
    lastNameProvided = true;
    parsedFirstName = split.firstName;
    parsedLastName = split.lastName;
  }

  if (firstNameProvided) {
    updates.firstName = parsedFirstName;
  }

  if (lastNameProvided) {
    updates.lastName = parsedLastName;
  }

  if (firstNameProvided || lastNameProvided) {
    const existingNames = await prisma.user.findUnique({
      where: { id },
      select: { firstName: true, lastName: true },
    });
    if (!existingNames) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }
    const effectiveFirstName = firstNameProvided ? parsedFirstName : existingNames.firstName;
    const effectiveLastName = lastNameProvided ? parsedLastName : existingNames.lastName;
    updates.name = combineNameParts(effectiveFirstName, effectiveLastName);
  } else if (fallbackNameProvided) {
    updates.name = fallbackFullName;
  }

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "E-Mail darf nicht leer sein" }, { status: 400 });
    }
    updates.email = email;
  } else if (body.email !== undefined) {
    return NextResponse.json({ error: "E-Mail muss eine Zeichenkette sein" }, { status: 400 });
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
      select: { id: true, email: true, firstName: true, lastName: true, name: true },
    });

    const responseName = combineNameParts(user.firstName, user.lastName) ?? (user.name ?? null);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        name: responseName,
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json({ error: "E-Mail wird bereits verwendet" }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
