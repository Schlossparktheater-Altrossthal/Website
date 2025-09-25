import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashOwnerSetupToken } from "@/lib/owner-setup";
import { hashPassword } from "@/lib/password";
import { combineNameParts, splitFullName, trimToNull } from "@/lib/names";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export async function POST(request: NextRequest) {
  const rawBody: unknown = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const {
    token: tokenValue,
    email: emailValue,
    password: passwordValue,
    name: nameValue,
    firstName: firstNameValue,
    lastName: lastNameValue,
  } = rawBody as {
    token?: unknown;
    email?: unknown;
    password?: unknown;
    name?: unknown;
    firstName?: unknown;
    lastName?: unknown;
  };

  if (typeof tokenValue !== "string" || !tokenValue.trim()) {
    return NextResponse.json({ error: "Der Link ist ungültig." }, { status: 400 });
  }

  if (typeof emailValue !== "string") {
    return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
  }

  const email = emailValue.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  if (typeof passwordValue !== "string") {
    return NextResponse.json({ error: "Passwort ist erforderlich" }, { status: 400 });
  }

  const password = passwordValue.trim();
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben` },
      { status: 400 },
    );
  }

  let firstName: string | null = null;
  if (firstNameValue !== undefined) {
    if (typeof firstNameValue !== "string") {
      return NextResponse.json({ error: "Vorname ist ungültig" }, { status: 400 });
    }
    firstName = trimToNull(firstNameValue);
  }

  let lastName: string | null = null;
  if (lastNameValue !== undefined) {
    if (typeof lastNameValue !== "string") {
      return NextResponse.json({ error: "Nachname ist ungültig" }, { status: 400 });
    }
    lastName = trimToNull(lastNameValue);
  }

  let fallbackName: string | null = null;
  if (nameValue !== undefined) {
    if (typeof nameValue !== "string") {
      return NextResponse.json({ error: "Name ist ungültig" }, { status: 400 });
    }
    fallbackName = trimToNull(nameValue);
  }

  if (!firstName && fallbackName) {
    const split = splitFullName(fallbackName);
    firstName = split.firstName;
    if (!lastName) {
      lastName = split.lastName;
    }
  }

  if (!firstName) {
    return NextResponse.json({ error: "Vorname ist erforderlich" }, { status: 400 });
  }

  const displayName = combineNameParts(firstName, lastName) ?? fallbackName ?? null;

  const tokenHash = hashOwnerSetupToken(tokenValue.trim());

  const setupToken = await prisma.ownerSetupToken.findUnique({
    where: { tokenHash },
  });

  if (!setupToken) {
    return NextResponse.json(
      { error: "Dieser Link ist nicht mehr gültig. Bitte starte den Server neu, um einen neuen Link zu erhalten." },
      { status: 410 },
    );
  }

  if (setupToken.consumedAt) {
    return NextResponse.json({ error: "Dieser Link wurde bereits verwendet." }, { status: 410 });
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.ownerSetupToken.updateMany({
        where: { id: setupToken.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new Error("TOKEN_ALREADY_USED");
      }

      const created = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          name: displayName,
          role: "owner",
          passwordHash,
          roles: {
            create: [{ role: "owner" }],
          },
        },
        select: { id: true, email: true, name: true, firstName: true, lastName: true },
      });

      await tx.ownerSetupToken.deleteMany({ where: { id: { not: setupToken.id } } });

      return created;
    });

    return NextResponse.json({ ok: true, user });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "TOKEN_ALREADY_USED") {
        return NextResponse.json({ error: "Dieser Link wurde bereits verwendet." }, { status: 410 });
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Diese E-Mail existiert bereits" }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Owner konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
