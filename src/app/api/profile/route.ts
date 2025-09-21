import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sortRoles, type Role } from "@/lib/roles";
import type { AvatarSource } from "@prisma/client";
import { combineNameParts, splitFullName, trimToNull } from "@/lib/names";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_SOURCE_VALUES = ["GRAVATAR", "UPLOAD", "INITIALS"] as const;

const isAvatarSource = (value: string): value is AvatarSource =>
  (AVATAR_SOURCE_VALUES as readonly string[]).includes(value);

function parseAvatarSource(value: unknown): AvatarSource | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return isAvatarSource(normalized) ? (normalized as AvatarSource) : null;
}

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
  }
  return value === true;
}

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
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      role: true,
      roles: { select: { role: true } },
      avatarSource: true,
      avatarImageUpdatedAt: true,
      dateOfBirth: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const roles = sortRoles([user.role as Role, ...user.roles.map((r) => r.role as Role)]);
  const fullName = combineNameParts(user.firstName, user.lastName) ?? (user.name ?? null);

  return NextResponse.json({
    id: user.id,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    name: fullName,
    email: user.email,
    roles,
    avatarSource: user.avatarSource,
    avatarUpdatedAt: user.avatarImageUpdatedAt?.toISOString() ?? null,
    dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> | null = null;
  let avatarFile: File | undefined;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const formBody: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (value instanceof File) {
        if (key === "avatarFile" && value.size > 0) {
          avatarFile = value;
        }
      } else {
        formBody[key] = value;
      }
    });
    body = formBody;
  } else {
    const rawJson = await request.json().catch(() => null);
    if (rawJson && typeof rawJson === "object") {
      body = rawJson as Record<string, unknown>;
    }
  }

  if (!body) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  let parsedAvatarSource: AvatarSource | null = null;

  let firstNameProvided = false;
  let lastNameProvided = false;
  let parsedFirstName: string | null = null;
  let parsedLastName: string | null = null;
  let fallbackNameProvided = false;
  let fallbackFullName: string | null = null;

  if ("firstName" in body) {
    firstNameProvided = true;
    const value = body.firstName;
    if (typeof value === "string") {
      parsedFirstName = trimToNull(value);
    } else if (value === null) {
      parsedFirstName = null;
    } else {
      return NextResponse.json({ error: "Ungültiger Vorname" }, { status: 400 });
    }
  }

  if ("lastName" in body) {
    lastNameProvided = true;
    const value = body.lastName;
    if (typeof value === "string") {
      parsedLastName = trimToNull(value);
    } else if (value === null) {
      parsedLastName = null;
    } else {
      return NextResponse.json({ error: "Ungültiger Nachname" }, { status: 400 });
    }
  }

  if ("name" in body) {
    fallbackNameProvided = true;
    const value = body.name;
    if (typeof value === "string") {
      fallbackFullName = trimToNull(value);
    } else if (value === null) {
      fallbackFullName = null;
    } else {
      return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 });
    }
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
      where: { id: userId },
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

  if ("dateOfBirth" in body) {
    const raw = body.dateOfBirth;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) {
        updates.dateOfBirth = null;
      } else {
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.valueOf())) {
          return NextResponse.json({ error: "Ungültiges Geburtsdatum" }, { status: 400 });
        }
        const now = new Date();
        if (parsed > now) {
          return NextResponse.json({ error: "Geburtsdatum darf nicht in der Zukunft liegen" }, { status: 400 });
        }
        updates.dateOfBirth = parsed;
      }
    } else if (raw === null) {
      updates.dateOfBirth = null;
    } else {
      return NextResponse.json({ error: "Ungültiges Geburtsdatum" }, { status: 400 });
    }
  }

  if ("avatarSource" in body) {
    const source = body.avatarSource;
    if (typeof source === "string") {
      const parsed = parseAvatarSource(source);
      if (!parsed) {
        return NextResponse.json({ error: "Ungültige Avatar-Quelle" }, { status: 400 });
      }
      parsedAvatarSource = parsed;
      updates.avatarSource = parsed;
    } else if (source !== undefined) {
      return NextResponse.json({ error: "Ungültige Avatar-Quelle" }, { status: 400 });
    }
  }

  const removeAvatar = "removeAvatar" in body ? parseBooleanFlag(body.removeAvatar) : false;

  let avatarBuffer: Buffer | undefined;
  let avatarMime: string | undefined;

  if (avatarFile) {
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: "Bild darf maximal 2 MB groß sein" }, { status: 400 });
    }
    const mime = avatarFile.type?.toLowerCase() ?? "";
    if (!AVATAR_MIME_TYPES.has(mime)) {
      return NextResponse.json({ error: "Nur JPG, PNG oder WebP werden unterstützt" }, { status: 400 });
    }
    const arrayBuffer = await avatarFile.arrayBuffer();
    avatarBuffer = Buffer.from(arrayBuffer);
    avatarMime = mime;
  }

  if (removeAvatar && !avatarBuffer) {
    updates.avatarImage = null;
    updates.avatarImageMime = null;
    updates.avatarImageUpdatedAt = null;
  }

  if (avatarBuffer) {
    updates.avatarImage = avatarBuffer;
    updates.avatarImageMime = avatarMime;
    updates.avatarImageUpdatedAt = new Date();
    if (!parsedAvatarSource) {
      parsedAvatarSource = "UPLOAD";
      updates.avatarSource = "UPLOAD";
    }
  }

  if (parsedAvatarSource === "UPLOAD" && !avatarBuffer && !removeAvatar) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarImageUpdatedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }
    if (!existing.avatarImageUpdatedAt) {
      return NextResponse.json({ error: "Bitte lade zuerst ein eigenes Bild hoch" }, { status: 400 });
    }
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
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        role: true,
        roles: { select: { role: true } },
        avatarSource: true,
        avatarImageUpdatedAt: true,
        dateOfBirth: true,
      },
    });

    const roles = sortRoles([updated.role as Role, ...updated.roles.map((r) => r.role as Role)]);
    const userFullName = combineNameParts(updated.firstName, updated.lastName) ?? (updated.name ?? null);

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        firstName: updated.firstName ?? null,
        lastName: updated.lastName ?? null,
        name: userFullName,
        email: updated.email,
        roles,
        avatarSource: updated.avatarSource,
        avatarUpdatedAt: updated.avatarImageUpdatedAt?.toISOString() ?? null,
        dateOfBirth: updated.dateOfBirth?.toISOString() ?? null,
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
