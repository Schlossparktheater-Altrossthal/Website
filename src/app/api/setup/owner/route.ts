import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashOwnerSetupToken, ownerExists } from "@/lib/owner-setup";
import { hashPassword } from "@/lib/password";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export async function POST(request: NextRequest) {
  const rawBody: unknown = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { token: tokenValue, email: emailValue, password: passwordValue, name: nameValue } = rawBody as {
    token?: unknown;
    email?: unknown;
    password?: unknown;
    name?: unknown;
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

  const name = typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : undefined;

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

      if (await ownerExists(tx)) {
        throw new Error("OWNER_ALREADY_EXISTS");
      }

      const created = await tx.user.create({
        data: {
          email,
          name: name ?? null,
          role: "owner",
          passwordHash,
          roles: {
            create: [{ role: "owner" }],
          },
        },
        select: { id: true, email: true, name: true },
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
      if (error.message === "OWNER_ALREADY_EXISTS") {
        return NextResponse.json({ error: "Es existiert bereits ein Owner." }, { status: 409 });
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Diese E-Mail existiert bereits" }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Owner konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
